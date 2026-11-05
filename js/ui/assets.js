// 「代入資產與負債」的結果：結論句、KPI、資源增減圖（純 DOM，列印友善）、數字表。
import { h, clear, css } from './dom.js';
import { money, signedMoney, years1 } from '../core/format.js';

const total = (v) => (v < 0 ? `－${money(-v)}` : money(v));
const KIND_CLASS = { total: 'wf-total', pos: 'wf-pos', neg: 'wf-neg' };

export function renderAssets(els, a, monthly, fromAdv = false, loans = null) {
  const { wrap, verdict, kpi, water, table, note } = els;
  clear(kpi); clear(water); clear(table);
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
    water.append(h('div', { class: 'wf-row' },
      h('div', { class: 'wf-label', text: `${s.sign ? `${s.sign} ` : ''}${s.label}` }),
      h('div', { class: 'wf-track' }, css(h('span', { class: 'wf-zero' }), { left: `${pct(0)}%` }), bar),
      h('div', { class: 'wf-val', text: text }),
    ));
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
