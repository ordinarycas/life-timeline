// 進階頁：匯入由 Excel 轉出的 JSON（生活支出月平均 + 借款利息），顯示摘要；資料只存在這個瀏覽器。
import { h, clear } from './ui/dom.js';
import { applyTheme } from './ui/theme.js';
import { money } from './core/format.js';
import { todayTaipei } from './core/clock.js';
import { LOAN_TYPES, parseAdvanced, loadAdvanced, loadAdvancedRaw, saveAdvanced, clearAdvanced, advancedSummary } from './core/advanced.js';
import { loadMarket, saveMarket, clearMarket, parseTwseDay, parseFx } from './core/market.js';

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 500 * 1024;

function render() {
  const adv = loadAdvanced();
  const box = $('adv-summary'); clear(box);
  $('adv-clear').hidden = !adv;
  if (!adv) { box.append(h('p', { text: '目前沒有匯入資料。匯入後，首頁的「累積收入曲線」會多一條線。' })); return; }
  const s = advancedSummary(adv, todayTaipei().slice(0, 7));
  const card = (k, v, note) => h('div', {}, h('dt', { text: k }), h('dd', {}, v, note ? h('span', { class: 'sub', text: note }) : null));
  box.append(
    h('p', {}, h('strong', { text: '已匯入' }), `（資料日期 ${adv.exportedAt || '未標示'}）`),
    h('dl', { class: 'kpi' },
      card('生活支出（每月平均）', money(adv.livingMonthlyAvg)),
      card('今天起貸款利息合計', money(s.interest), s.lastYm ? `信貸、循環額度、保單借款，最後一期 ${s.lastYm}` : '沒有未來的借款'),
      card('今天起借款本金合計', money(s.principal), '曲線每月扣本金＋利息'),
    ),
    s.loans.length || s.pledge ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('caption', { text: '目前的借款（只列類型，不含銀行名稱）' }),
      h('thead', {}, h('tr', {}, ['類型', '目前本金（NT$）', '年利率'].map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {},
        s.loans.map((l) => h('tr', {}, h('th', { scope: 'row', text: LOAN_TYPES[l.type] }), h('td', { text: money(l.balance) }), h('td', { text: `${(l.rate * 100).toFixed(2)}%` }))),
        s.pledge ? h('tr', {}, h('th', { scope: 'row', text: '股票質押' }), h('td', { text: money(s.pledge.borrowed) }), h('td', { text: `${(s.pledge.rate * 100).toFixed(2)}%` })) : null)),
      ) : null,
    s.pledge ? h('p', { class: 'note', text: `股票質押每月利息約 ${money(s.pledge.monthlyInterest)}（質押標的現值 ${money(s.pledge.stockValue)}）。假設本金不還、持續展延，曲線與餘裕會一直扣這筆利息；若你打算還清，結果會比實際悲觀。` }) : null,
    s.byYear.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('caption', { text: '各年度還款（貸款：每月還款＝利息＋本金）' }),
      h('thead', {}, h('tr', {}, ['年度', '利息（NT$）', '本金（NT$）', '還款合計（NT$）'].map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, s.byYear.map((y) => h('tr', {}, h('th', { scope: 'row', text: y.year }), h('td', { text: money(y.interest) }), h('td', { text: money(y.principal) }), h('td', { text: money(y.interest + y.principal) })))))) : null,
    monthlyTable(adv, todayTaipei().slice(0, 7)),
  );
}

/** 逐月還款明細：每筆貸款「利息＋本金＝月繳」，股票質押只繳利息。 */
function monthlyTable(adv, todayYm) {
  const rows = adv.months.filter((x) => x.ym >= todayYm);
  if (!rows.length) return null;
  const types = Object.keys(LOAN_TYPES).filter((t) => rows.some((x) => x.parts?.[t] && (x.parts[t].interest || x.parts[t].principal)));
  const pledgeInt = adv.pledge?.monthlyInterest ?? 0;
  const cell = (p) => (p ? `${money(p.interest + p.principal)}（利息 ${money(p.interest)}＋本金 ${money(p.principal)}）` : '—');
  const heads = ['月份', ...types.map((t) => LOAN_TYPES[t]), ...(pledgeInt ? ['股票質押（只繳利息）'] : []), '當月還款合計（NT$）'];
  return h('details', { class: 'card' },
    h('summary', {}, h('span', { class: 'sum-title', text: '逐月還款明細' }), h('span', { class: 'sum-line', text: `${rows.length} 個月` })),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, heads.map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, rows.map((x) => h('tr', {}, h('th', { scope: 'row', text: x.ym }),
        ...types.map((t) => h('td', { text: cell(x.parts?.[t]) })),
        ...(pledgeInt ? [h('td', { text: money(pledgeInt) })] : []),
        h('td', { text: money(x.interest + x.principal + pledgeInt) })))))),
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

/** 取得某檔上市股票最近一個交易日的收盤價（本月沒資料就往前一個月找）。 */
async function twsePrice(code, todayIso) {
  const [y, m] = todayIso.split('-').map(Number);
  for (const [yy, mm] of [[y, m], m === 1 ? [y - 1, 12] : [y, m - 1]]) {
    const date = `${yy}${String(mm).padStart(2, '0')}01`;
    const got = parseTwseDay(await getJson(`https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${encodeURIComponent(code)}`));
    if (got) return got;
    await sleep(1500);
  }
  return null;
}

function renderMarket() {
  const raw = loadAdvancedRaw();
  const m = loadMarket();
  const box = $('adv-market-table'); clear(box);
  $('adv-update').disabled = !raw;
  $('adv-market-clear').hidden = !m;
  if (!raw) { setMarketStatus('匯入進階資料後才能更新。'); return; }
  if (!m) return;
  const rows = [];
  if (raw.fx) rows.push(h('tr', {}, h('th', { scope: 'row', text: 'USD/TWD 匯率' }), h('td', { text: `匯入時 ${raw.fx}` }), h('td', { text: m.fx ? `${m.fx.rate.toFixed(4)}（${m.fx.at || '時間未標示'}）` : '未更新，沿用匯入值' })));
  for (const x of raw.holdings) {
    const p = m.prices[x.code];
    rows.push(h('tr', {}, h('th', { scope: 'row', text: `${x.code}（${x.market === 'TWSE' ? '上市' : '上櫃'}）` }), h('td', { text: `匯入時 ${x.price}` }),
      h('td', { text: p ? `${p.price}（收盤 ${p.date}）` : x.market === 'TPEX' ? '上櫃：沿用匯入價' : '未更新，沿用匯入價' })));
  }
  box.append(h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
    h('thead', {}, h('tr', {}, ['項目', '匯入的資料', '線上更新'].map((t) => h('th', { scope: 'col', text: t })))), h('tbody', {}, rows))),
  h('p', { class: 'note', text: `最後更新：${m.updatedAt || '—'}。股價是證交所最近一個交易日的收盤價，不是即時報價。` }));
}
function setMarketStatus(text, bad = false) { const e = $('adv-market-status'); e.textContent = text; e.classList.toggle('is-bad', bad); }

$('adv-update').addEventListener('click', async () => {
  const raw = loadAdvancedRaw();
  if (!raw) return;
  const btn = $('adv-update'); btn.disabled = true;
  const prev = loadMarket();
  const next = { fx: prev?.fx ?? null, prices: { ...(prev?.prices ?? {}) }, updatedAt: '' };
  const problems = [];
  try {
    if (raw.fx) {
      setMarketStatus('更新匯率⋯');
      try { const fx = parseFx(await getJson('https://open.er-api.com/v6/latest/USD')); if (fx) next.fx = fx; else problems.push('匯率'); } catch { problems.push('匯率'); }
    }
    const codes = [...new Set(raw.holdings.filter((x) => x.market === 'TWSE').map((x) => x.code))];
    const today = todayTaipei();
    for (const [i, code] of codes.entries()) {
      setMarketStatus(`更新股價 ${i + 1}／${codes.length}（${code}）⋯`);
      try { const p = await twsePrice(code, today); if (p) next.prices[code] = p; else problems.push(code); } catch { problems.push(code); }
      if (i < codes.length - 1) await sleep(1500); // 證交所會限制短時間大量查詢
    }
    next.updatedAt = new Date().toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });
    saveMarket(next);
    setMarketStatus(problems.length ? `部分更新完成；以下項目失敗，沿用原本的值：${problems.join('、')}。` : '更新完成。回首頁查看累積收入曲線與餘裕。', problems.length > 0);
  } catch (e) { setMarketStatus('更新失敗，請稍後再試。', true); }
  btn.disabled = false;
  renderMarket(); render();
});
$('adv-market-clear').addEventListener('click', () => { clearMarket(); setMarketStatus('已清除線上更新，回到匯入時的股價與匯率。'); renderMarket(); render(); });

function setStatus(text, bad = false) { const e = $('adv-status'); e.textContent = text; e.classList.toggle('is-bad', bad); }

$('adv-file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > MAX_BYTES) { setStatus('檔案太大（超過 500 KB），這不像是轉出的進階資料。', true); return; }
  try {
    const adv = parseAdvanced(JSON.parse(await f.text()));
    saveAdvanced(adv);
    setStatus(`匯入成功：${adv.months.length} 個月的借款資料。回首頁查看累積收入曲線。`);
    renderMarket();
  } catch (err) { setStatus(`匯入失敗：${err instanceof SyntaxError ? '檔案不是 JSON 格式。' : err.message}`, true); }
  render();
});
$('adv-clear').addEventListener('click', () => { clearAdvanced(); setStatus('已清除匯入的資料。'); render(); });

try {
  const p = JSON.parse(localStorage.getItem('ltl.prefs.v1') || 'null');
  if (p?.theme === 'dark' || p?.theme === 'auto') applyTheme(p.theme);
} catch { /* 維持預設淺色 */ }
render();
renderMarket();

// 舊版快取：Service Worker 先給舊檔、背景才更新。進階頁載入時主動檢查更新，新版接手後自動重新載入一次。
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && document.getElementById('adv-file').value === '') { reloaded = true; location.reload(); } });
  navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
}
