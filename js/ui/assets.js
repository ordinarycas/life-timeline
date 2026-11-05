// 「代入資產與負債」的結果：結論句、KPI、資源增減圖（純 DOM，列印友善）、數字表。
import { h, clear, css } from './dom.js';
import { money, signedMoney, years1 } from '../core/format.js';
import { LEVELS, assessAssets, stepHelp } from '../core/assets.js';

// 資源增減圖的浮動說明：滑鼠移過、鍵盤聚焦或觸控點選時顯示；Esc、點空白處或捲動時關閉
let tipEl = null;
let tipFor = null;
function ensureTip() {
  if (!tipEl) {
    tipEl = h('div', { class: 'wf-tip', id: 'wf-tip', role: 'tooltip', hidden: true });
    document.body.append(tipEl);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
    document.addEventListener('pointerdown', (e) => { if (tipFor && !tipFor.contains(e.target)) hideTip(); });
    addEventListener('scroll', () => hideTip(), { passive: true });
  }
  return tipEl;
}
function hideTip() { if (tipEl) tipEl.hidden = true; tipFor = null; }
function showTip(row, title, text) {
  const t = ensureTip();
  clear(t); t.append(h('strong', { text: title }), h('span', { text }));
  t.hidden = false; tipFor = row;
  const r = row.getBoundingClientRect();
  const w = Math.min(340, innerWidth - 16);
  t.style.width = `${w}px`;
  const left = Math.min(Math.max(8, r.left + 12), innerWidth - w - 8);
  const below = r.bottom + 8;
  t.style.left = `${left}px`;
  const top = below + t.offsetHeight > innerHeight - 8 ? r.top - t.offsetHeight - 8 : below;
  t.style.top = `${Math.min(Math.max(8, top), Math.max(8, innerHeight - t.offsetHeight - 8))}px`;
}
function bindTip(row, title, text) {
  row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(row, title, text); });
  row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && document.activeElement !== row) hideTip(); });
  row.addEventListener('focus', () => showTip(row, title, text));
  row.addEventListener('blur', () => hideTip());
  row.addEventListener('click', () => { if (tipFor === row && tipEl && !tipEl.hidden && document.activeElement !== row) hideTip(); else showTip(row, title, text); });
}

const total = (v) => (v < 0 ? `－${money(-v)}` : money(v));
const KIND_CLASS = { total: 'wf-total', pos: 'wf-pos', neg: 'wf-neg' };

export function renderAssets(els, a, monthly, fromAdv = false, loans = null) {
  const { wrap, verdict, kpi, water, table, note, level } = els;
  clear(kpi); clear(water); clear(table); clear(level);
  hideTip();
  const item = (label, value, sub, cls = '') => h('div', { class: cls }, h('dt', { text: label }), h('dd', {}, value, sub ? h('span', { class: 'sub', text: sub }) : null));

  verdict.textContent = a.enough
    ? `把資產、借款和固定支出都算進去，餘命內約還有 ${money(a.surplus)} 的餘裕（假設支出不變）。`
    : `把資產、借款和固定支出都算進去，餘命內約有 ${money(-a.surplus)} 的缺口（假設支出不變）；可以調整支出、退休年齡或月收入再看看。`;
  verdict.className = `verdict ${a.enough ? 'ok' : 'gap'}`;

  kpi.append(
    item('人生最低收入', money(a.income), '退休前還能累積'),
    item('＋ 資產', money(a.assets), '存款＋投資＋其他'),
    item('－ 尚未償還的借款', money(a.debts), a.debtMonths != null ? `約等於 ${years1(a.debtMonths)} 個月的收入` : '本金＋預估利息', a.debts > 0 ? 'neg' : ''),
    item('＝ 還清借款後的總資源', money(a.resources), null, 'coin'),
    item('平均每月可用（餘命分攤）', money(a.perMonth), `分攤到剩下的 ${a.lifeMonths} 個月`),
    item('目前每月固定支出', money(a.expense), a.expenseRatio != null ? `占月收入 ${Math.round(a.expenseRatio * 100)}%` : null),
    item('若支出不變，餘命內合計', money(a.lifeExpense), null),
    item(a.enough ? '扣除支出後的餘裕' : '扣除支出後的缺口', money(Math.abs(a.surplus)), a.enough ? '還有餘裕' : '支出超過可用資源', a.enough ? 'ok' : 'gap'),
  );

  // 五個等級：依「總資源 ÷ 餘命內固定支出」
  const as = assessAssets(a);
  if (!as) level.append(h('p', { class: 'note', text: '填了「每月固定生活支出」後，這裡會依計算結果評出五個等級（缺口、吃緊、剛好、餘裕、完美）並提供建議。' }));
  else {
    level.append(
      h('div', { class: `lv-meter lv-${as.level}`, role: 'img', 'aria-label': `目前等級：${as.name}（第 ${as.level} 級，共 5 級）` },
        LEVELS.map((l) => h('span', { class: `lv-seg${l.level === as.level ? ' is-on' : ''}${l.level < as.level ? ' is-below' : ''}` }, h('b', { text: String(l.level) }), l.name))),
      h('p', { class: 'lv-head' }, h('strong', { text: `第 ${as.level} 級：${as.name}` }), `｜${as.summary}（總資源是餘命內支出的 ${(as.ratio * 100).toFixed(0)}%）`),
      h('ul', { class: 'lv-advice' }, as.advice.map((t) => h('li', { text: t })),
        as.toNext != null ? h('li', { text: `再增加約 ${money(as.toNext)} 的資源（或減少同額支出、借款），就會升到「${as.nextName}」。` }) : null,
        as.maxMonthlyExpense > 0 ? h('li', { text: `每月最多可花約 ${money(as.maxMonthlyExpense)}，才不會出現缺口。` }) : null),
      h('p', { class: 'note', text: '等級門檻（缺口、吃緊、剛好、餘裕、完美）是本站自訂的粗略分級：總資源占餘命內支出的比例：100% 以下為缺口、超過 100% 為吃緊、125% 起為剛好、150% 起為餘裕、200%（2 倍）以上為完美。這不是財務建議，也不預測壽命。' }),
    );
  }

  // 資源增減圖：每一步一條橫條，起訖位置依累計值換算成百分比
  const vals = a.steps.flatMap((s) => [s.from, s.to, 0]);
  const lo = Math.min(...vals); const hi = Math.max(...vals);
  const span = Math.max(hi - lo, 1);
  const pct = (v) => ((v - lo) / span) * 100;
  for (const s of a.steps) {
    const a0 = Math.min(s.from, s.to); const b0 = Math.max(s.from, s.to);
    const bar = h('span', { class: `wf-bar ${KIND_CLASS[s.kind]}${s.to < 0 && s.kind === 'total' ? ' wf-low' : ''}` });
    css(bar, { left: `${pct(a0)}%`, width: `${Math.max(((b0 - a0) / span) * 100, 0.6)}%` });
    const text = s.kind === 'total' ? total(s.value) : `${s.sign}${money(Math.abs(s.value))}`;
    const help = stepHelp(a, monthly, money)[s.key];
    const rowEl = h('div', { class: 'wf-row', tabindex: '0', 'aria-describedby': 'wf-tip', 'aria-label': `${s.label}：${text}。${help}` },
      h('div', { class: 'wf-label', text: `${s.sign ? `${s.sign} ` : ''}${s.label}` }),
      h('div', { class: 'wf-track' }, css(h('span', { class: 'wf-zero' }), { left: `${pct(0)}%` }), bar),
      h('div', { class: 'wf-val', text: text }),
    );
    bindTip(rowEl, s.label, help);
    water.append(rowEl);
  }

  const th = (t, cls = '') => h('th', { scope: 'col', text: t, class: cls });
  table.append(
    h('thead', {}, h('tr', {}, th('項目'), th('金額', 'num'))),
    h('tbody', {}, a.steps.map((s) => h('tr', {}, h('th', { scope: 'row', text: `${s.sign ? `${s.sign} ` : ''}${s.label}` }),
      h('td', { class: 'num', text: s.kind === 'total' ? total(s.value) : signedMoney(s.sign === '－' ? -s.value : s.value) })))),
  );
  note.textContent = `算法：人生最低收入（${money(monthly)} × 到退休的月數）＋ 資產 － 借款本金與你估的利息 － 每月固定支出 × 剩餘月數。金額固定、以今天的新台幣計，不含通膨、投資報酬、退休金、勞保年金與自住不動產的居住價值；資產只計你填的項目。這是粗略的對照，不是理財或投資建議。`;
  if (loans) note.textContent += ` 其中你新增的貸款本金 ${money(loans.principal)}、預估利息 ${money(loans.interest)}（本息平均攤還，每月合計還款約 ${money(loans.monthly)}）。`;
  if (fromAdv) note.textContent += ' 本次借款（含股票質押）、利息、每月支出與投資現值來自「進階」匯入的資料：生活支出為 12 個月平均，股票質押假設本金不還、利息持續到餘命結束。';
  wrap.hidden = false;
}

export const hideAssets = (els) => { els.wrap.hidden = true; };
