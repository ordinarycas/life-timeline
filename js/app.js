// 進入點：載入偏好設定 → 建立時間軸模型 → 繪製四個區塊。所有資料只在瀏覽器內處理。
import { todayTaipei } from './core/clock.js';
import { buildTimeline } from './core/placement.js';
import { computeKpi } from './core/kpi.js';
import { computeAssets, hasAssetInput } from './core/assets.js';
import { renderAssets, hideAssets } from './ui/assets.js';
import { loadPrefs, savePrefs, loadHints, saveHints } from './data/prefs.js';
import { MUSIC } from './data/music.js';
import { loadContent, fetchJson } from './data/loader.js';
import { ageText, years1, money, signedMoney, lvText } from './core/format.js';
import { BASELINE_WAGE } from './data/wage.js';
import { h, clear, toast } from './ui/dom.js';
import { initTheme } from './ui/theme.js';
import { loadFonts } from './ui/fonts.js';
import { createTimeline } from './ui/timeline.js';
import { initTimelineTools } from './ui/timelinetools.js';
import { renderInfo } from './ui/infocard.js';
import { stateText, rowRange } from './ui/timeline.js';
import { initSettings } from './ui/settings.js';
import { renderDetails, jumpToTag, setAllCards } from './ui/details.js';
import { renderIncome } from './ui/income.js';
import { initTabs } from './ui/tabs.js';
import { loadAdvanced, advancedAssetInputs } from './core/advanced.js';
import { loansTotal, loanRemaining } from './core/loans.js';
import { renderCurve, curveTable, setPrintMode, destroyCurve } from './ui/incomecurve.js';
import { initPlayer } from './ui/player.js';
import { initHints } from './ui/hints.js';
import { initPrint } from './ui/print.js';
import { initInstall } from './ui/install.js';
import { renderFooter } from './ui/footer.js';
import { checkForUpdate, applyUpdate, registerSW, swEnabled } from './ui/update.js';

const $ = (id) => document.getElementById(id);
try { await loadContent(fetchJson); } catch (e) {
  $('stage-sub').textContent = '資料載入失敗，請重新整理頁面；若持續發生請檢查網路或稍後再試。';
  throw e;
}
let prefs = loadPrefs(undefined, { todayIso: todayTaipei(), musicIds: MUSIC.map((m) => m.id) });
let model = null;
let kpi = null;
let reg = null;
let warnedSave = false;
const hints = loadHints();
const setHint = (k, v) => { hints[k] = v; saveHints(undefined, hints); };

const save = () => {
  if (!savePrefs(undefined, prefs) && !warnedSave) {
    warnedSave = true;
    toast('無法儲存設定（瀏覽器可能封鎖了儲存空間），這次的設定關閉頁面後會消失。', 6000);
  }
};

const timeline = createTimeline({
  map: $('stage-map'), tl: $('tl'), legend: $('tl-legend'), special: $('tl-special'),
  mainbar: $('tl-mainbar'), decades: $('tl-decades'), lanes: $('tl-lanes'), tip: $('tl-tip'),
}, {
  onSelect: () => drawInfo(),
  onJump: (id) => jumpToTag(id),
  onZoom: (z) => tools?.onZoom(z),
});
let lastCurve = null; // 圖片附上的內容：目前的曲線參數與資產結果（沒有資料就是 null）
let lastAssets = null;
const tools = initTimelineTools({
  timeline,
  getExtras: () => ({ curve: lastCurve, assets: lastAssets }),
  initial: { curve: !!hints.imgCurve, assets: !!hints.imgAssets },
  onOpt: (k, v) => setHint(k === 'curve' ? 'imgCurve' : 'imgAssets', v),
  els: {
    optCurve: $('tl-opt-curve'), optAssets: $('tl-opt-assets'),
    zoomIn: $('tl-zoom-in'), zoomOut: $('tl-zoom-out'), zoomReset: $('tl-zoom-reset'), share: $('tl-share'), shareLink: $('tl-share-link'), download: $('tl-download'), print: $('tl-print-img'),
    img: $('print-img'), title: $('stage-title'), sub: $('stage-sub'),
  },
});

function drawInfo() {
  if (!model) return;
  renderInfo($('infocard'), {
    row: timeline.selected, model, kpi, chances: chanceRows(), onClose: () => timeline.select(null),
    owned: infoOwned(), onOwn: setOwned,
    collapsed: !!hints.infoCollapsed, onToggle: () => { setHint('infoCollapsed', !hints.infoCollapsed); drawInfo(); },
  });
}

const item = (label, value, sub, cls = '') => h('div', { class: cls }, h('dt', { text: label }), h('dd', {}, value, sub ? h('span', { class: 'sub', text: sub }) : null));

function drawResults() {
  lastCurve = null; lastAssets = null;
  $('results').hidden = model.demo;
  if (model.demo) return;
  const { inc, base, late, kid, monthly } = kpi;
  $('kpi-zero').hidden = monthly > 0;
  const time = $('kpi-time'); clear(time);
  time.append(
    item('現在', `LV ${lvText(model.lv)}`, `${ageText(model.age)} 歲`),
    item('平均餘命', `${years1(model.lifeLeft)} 年`, `平均預期壽命 ${ageText(model.endAge)} 歲（不是預測你的壽命）`),
    item('距離退休', inc.retired ? '已到退休年齡' : `${years1(inc.workYears)} 年`, `預計 ${model.retire} 歲退休`),
    item('退休後', `${years1(inc.retirementYears)} 年`, '退休年齡到平均預期壽命'),
  );
  const money$ = $('kpi-money'); clear(money$);
  money$.append(...[
    item('月收入', money(monthly), '稅前，以今天的新台幣計'),
    item('金幣：退休前還能累積', money(inc.income), `共 ${inc.workMonths} 個月`, 'coin'),
    item('平均分到每個月', money(inc.perLifeMonth), `把這筆錢平均分到剩下的 ${inc.lifeMonths} 個月`),
    kid != null ? item('育兒區間與工作期重疊', `${years1(kid)} 年`, '育兒以 18 年計（簡化假設）') : null,
  ].filter(Boolean));
  $('kpi-base-wrap').hidden = !base;
  if (base) drawCompare(base);
  $('kpi-late-wrap').hidden = !late;
  if (late) {
    const l = $('kpi-late'); clear(l);
    l.append(
      item(`從 ${late.start} 歲才開始領`, money(late.lateIncome), `比現在開始少約 ${money(late.lost)}`),
      item('晚了', `${years1(late.delayYears)} 年`, '從現在算起'),
    );
  }
  // 資產負債：有填任何一項才顯示
  const assetEls = { wrap: $('asset-wrap'), verdict: $('asset-verdict'), kpi: $('asset-kpi'), water: $('water'), table: $('asset-table'), note: $('asset-note'), level: $('asset-level') };
  // 「代入進階資料」：用匯入的借款本金、利息與生活支出月平均取代手填的借款與支出（資產仍用手填）
  const adv = loadAdvanced();
  const useAdv = !!(prefs.useAdv && adv);
  $('f-use-adv').disabled = !adv;
  $('adv-hint').textContent = adv ? '' : '還沒有匯入進階資料。到「進階」頁匯入後，這裡就能勾選。';
  const base0 = useAdv ? { ...prefs, ...advancedAssetInputs(adv, todayTaipei().slice(0, 7), inc.lifeMonths) } : prefs;
  // 使用者自行新增的貸款：本金與預估利息加進借款
  const lt = loansTotal(prefs.loans);
  const mg = prefs.mortgage;
  if (mg) {
    const start = mg.start > 0 ? mg.start : model.age;
    const rem = loanRemaining({ principal: mg.amount, months: mg.years * 12, rate: mg.rate }, Math.max(Math.round((model.age - start) * 12), 0));
    if (rem.remainingMonths > 0) { lt.principal += rem.balance; lt.interest += rem.interest; lt.monthly += rem.monthly; }
  }
  const assetPrefs = lt.principal > 0 ? { ...base0, debt: base0.debt + lt.principal, debtInterest: base0.debtInterest + lt.interest } : base0;
  if (hasAssetInput(assetPrefs)) {
    const result = computeAssets({ income: inc.income, lifeMonths: inc.lifeMonths, monthly }, assetPrefs);
    renderAssets(assetEls, result, monthly, useAdv, lt.principal > 0 ? lt : null);
    lastAssets = { a: result, monthly, fromAdv: useAdv, loans: lt.principal > 0 ? lt : null };
  } else hideAssets(assetEls);
  // 曲線
  const can = monthly > 0 && inc.stopAge > model.age;
  $('curve-box').hidden = !can; $('curve-table-wrap').hidden = !can; $('curve-empty').hidden = can;
  if (can) {
    const todayYm = todayTaipei().slice(0, 7);
    const cp = adv ? { ...kpi.curve, todayYm, adv: { data: adv, todayYm } } : { ...kpi.curve, todayYm };
    lastCurve = cp;
    renderCurve($('curve'), cp).catch(() => { $('curve-empty').hidden = false; $('curve-empty').textContent = '圖表載入失敗，請看下方表格。'; });
    curveTable($('curve-table'), cp);
  } else destroyCurve();
}

function drawCompare(base) {
  const { inc, monthly, startAge, mineIncome } = kpi;
  const t = $('cmp-table'); clear(t);
  const mineYears = Math.max(inc.stopAge - startAge, 0);
  const th = (x, scope = 'col', cls = '') => h('th', { scope, text: x, class: cls });
  const row = (label, a, b, diff, cls = '') => h('tr', {}, th(label, 'row'), h('td', { class: `num ${cls}`, text: a }), h('td', { class: `num ${cls}`, text: b }), h('td', { class: `num ${cls}`, text: diff ?? '—' }));
  t.append(
    h('thead', {}, h('tr', {}, th('項目'), th('18 歲開始工作', 'col', 'num'), th(`從 ${ageText(startAge)} 歲開始（你的設定）`, 'col', 'num'), th('差距（你的設定 − 18 歲開始）', 'col', 'num'))),
    h('tbody', {},
      row('開始年齡', '18 歲', `${ageText(startAge)} 歲`, `晚 ${years1(startAge - base.baseAge)} 年`),
      row('工作年數（到退休）', `${years1(base.years)} 年`, `${years1(mineYears)} 年`, `${mineYears - base.years >= 0 ? '＋' : '－'}${years1(Math.abs(mineYears - base.years))} 年`),
      row('月收入', money(BASELINE_WAGE), money(monthly), signedMoney(monthly - BASELINE_WAGE)),
      row('到退休的累積總收入', money(base.baseIncome), money(mineIncome), signedMoney(mineIncome - base.baseIncome), 'coin'),
      row('平均每年', money(base.baseIncome / base.years), mineYears > 0 ? money(mineIncome / mineYears) : '—', null),
    ),
  );
  $('cmp-note').textContent = `18 歲開始的算法：基本工資 ${money(BASELINE_WAGE)} × 12 × ${years1(base.years)} 年（18 歲到退休）。「你的設定」的起點是${kpi.late ? `你填的 ${late_start()} 歲` : '現在'}，已經過去的年數不計入。`;
}
const late_start = () => kpi.late.start;

// 資訊卡的「已取得／已達成」勾選：學歷與證照存在 have；兵役存在 service（done）
function infoOwned() {
  const r = timeline.selected;
  if (!r) return false;
  return r.tag.id === 'service-active' ? prefs.service === 'done' : prefs.have.includes(r.id);
}
function setOwned(row, checked) {
  if (row.tag.id === 'service-active') prefs = { ...prefs, service: checked ? 'done' : 'auto' };
  else prefs = { ...prefs, have: checked ? [...new Set([...prefs.have, row.id])] : prefs.have.filter((x) => x !== row.id) };
  save(); settings.refresh(prefs); render();
}

// 目前這個年紀的機會：進行中、年齡已過但尚未取得、以及 3 年內即將到來的
function chanceRows() {
  return model.rows.filter((r) => r.tag.opportunity && (r.state === 'now' || r.state === 'chance' || (r.state === 'future' && r.start - model.age <= 3)));
}

function drawChances() {
  const ul = $('chances-list'); clear(ul);
  const rows = chanceRows();
  if (!rows.length) { ul.append(h('li', { text: '目前這個年紀沒有可列出的機會項目；各項規定見下方「標籤詳細說明」。' })); return; }
  for (const r of rows) {
    ul.append(h('li', {},
      h('strong', { text: r.label }),
      h('div', { class: 'meta', text: `${rowRange(r)}｜${stateText(r.state, r.tag)}` }),
      h('div', { text: r.tag.opportunity }),
      h('a', { href: `#tag-${r.id}`, text: '看詳細說明與來源' }),
    ));
  }
}

function drawTable() {
  const t = $('tl-table'); clear(t);
  const th = (x) => h('th', { scope: 'col', text: x });
  t.append(h('tr', {}, th('標籤'), th('類型'), th('年齡'), th('狀態')));
  for (const ms of model.milestones) t.append(h('tr', {}, h('td', { text: `基本收入累積 ${ms.amount / 10000} 萬` }), h('td', { text: '里程' }), h('td', { text: `${ageText(ms.age)} 歲` }), h('td', { text: ms.age <= model.age ? '已達到' : '尚未到' })));
  for (const r of model.rows) t.append(h('tr', {}, h('td', { text: r.label }), h('td', { text: r.tag.kind }), h('td', { text: r.point ? `${ageText(r.at)} 歲` : `${ageText(r.from)}–${ageText(r.to)} 歲` }), h('td', { text: stateText(r.state, r.tag) })));
}

function syncHealth() {
  const b = $('tl-health');
  b.setAttribute('aria-pressed', String(!!prefs.health));
  b.textContent = prefs.health ? '健康參考：顯示' : '健康參考：隱藏';
}
$('tl-health').addEventListener('click', () => { prefs = { ...prefs, health: !prefs.health }; save(); render(); });

function render() {
  syncHealth();
  const todayIso = todayTaipei();
  model = buildTimeline(prefs, todayIso);
  kpi = computeKpi(model, prefs);
  const prevId = timeline.selected?.id;
  $('demo-note').hidden = !model.demo;
  $('stage-sub').textContent = `LV ${lvText(model.lv)}｜平均預期壽命 ${ageText(model.endAge)} 歲，還有約 ${years1(model.lifeLeft)} 年｜預計 ${model.retire} 歲退休`;
  timeline.render(model);
  if (prevId && model.rows.some((r) => r.id === prevId)) timeline.reselect(prevId); else { if (prevId) timeline.select(null); drawInfo(); }
  drawTable();
  drawChances();
  renderIncome($('income-list'), $('income-lead'), prefs.have);
  renderDetails($('details-list'), $('general-sources'), model);
  drawResults();
  tools.setAvailable({ curve: !!lastCurve, assets: !!lastAssets });
  settings?.summary(model, kpi.monthly);
}

let settings = null;
settings = initSettings({
  prefs, getToday: todayTaipei,
  onChange: (p) => { prefs = p; save(); render(); },
  onClear: (p) => { prefs = p; save(); initThemeApply(); render(); },
});

function initThemeApply() { document.documentElement.setAttribute('data-theme', 'light'); $('theme-toggle').textContent = '主題：淺色'; }
initTheme($('theme-toggle'), prefs.theme, (t) => { prefs = { ...prefs, theme: t }; save(); render(); });
initPlayer($('player'), prefs, (patch) => { prefs = { ...prefs, ...patch }; save(); }, { collapsed: !!hints.playerCollapsed, onCollapse: (v) => setHint('playerCollapsed', v) });
initHints($('landscape-hint'), $('landscape-ok'), hints, setHint);
initInstall($('install-app'), $('ios-install'));
initPrint({
  buttons: [$('print-btn'), $('print-btn-2')], timeline, curve: { setPrintMode },
  detailsToOpen: () => [$('settings-card'), $('asset-card'), ...document.querySelectorAll('details.tagcard, details.income-group, details.countries')],
});

// 更新：啟動時與前景每 30 分鐘檢查一次；有新版顯示橫幅，使用者按下才套用
async function updateCheck(manual) {
  const r = await checkForUpdate();
  if (r === 'new') { $('update-banner').hidden = false; if (manual) toast('有新版本，請按上方「立即更新」。'); }
  else if (manual) toast(r === 'same' ? '已經是最新版。' : '目前無法檢查更新（可能離線）。');
}
$('apply-update').addEventListener('click', () => applyUpdate(reg));
renderFooter({ onCheck: () => updateCheck(true) });

$('details-expand').addEventListener('click', () => setAllCards($('details-list'), true));
$('details-collapse').addEventListener('click', () => setAllCards($('details-list'), false));
addEventListener('hashchange', () => { if (location.hash.startsWith('#tag-')) jumpToTag(location.hash.slice(5)); });
initTabs($('bottomnav'));
loadFonts();
render();
registerSW(swEnabled()).then((r) => { reg = r; });
if (swEnabled()) {
  updateCheck(false);
  setInterval(() => { if (document.visibilityState === 'visible') updateCheck(false); }, 30 * 60 * 1000);
}
// 回到前景時重算（跨日後年齡會變）
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { settings.refresh(prefs); render(); } });
// 網址帶 #tag-xxx 時，內容渲染後再捲動
if (location.hash.startsWith('#tag-')) requestAnimationFrame(() => jumpToTag(location.hash.slice(5)));
