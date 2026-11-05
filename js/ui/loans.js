// 「新增貸款」列表：每筆填借款本金、期數（月）、年利率（%），即時算出每月還款與總利息。
import { h, clear } from './dom.js';
import { money } from '../core/format.js';
import { MAX_LOANS, validateLoan, loanCost } from '../core/loans.js';

/**
 * @param {{list:HTMLElement, addBtn:HTMLButtonElement, onChange:(loans:object[])=>void}} o
 * @returns {{set:(loans:object[])=>void}}
 */
export function initLoans({ list, addBtn, onChange }) {
  const rows = []; // { principal, months, rate, el, result }

  function emit() {
    const valid = [];
    for (const r of rows) {
      const v = validateLoan({ principal: r.inputs.principal.value, months: r.inputs.months.value, rate: r.inputs.rate.value });
      if (v.ok) {
        const c = loanCost(v.value);
        r.result.textContent = `每月還款約 ${money(c.monthly)}（本金＋利息），總利息約 ${money(c.interest)}`;
        r.result.classList.remove('is-bad');
        valid.push(v.value);
      } else {
        const empty = !r.inputs.principal.value && !r.inputs.months.value && !r.inputs.rate.value;
        r.result.textContent = empty ? '' : v.error;
        r.result.classList.toggle('is-bad', !empty);
      }
    }
    addBtn.disabled = rows.length >= MAX_LOANS;
    onChange(valid);
  }

  function add(loan = {}) {
    if (rows.length >= MAX_LOANS) return;
    const n = rows.length + 1;
    const field = (key, label, step, val, hint) => {
      const id = `loan-${Date.now()}-${n}-${key}`;
      const input = h('input', { type: 'number', id, inputmode: 'decimal', min: '0', step, value: val ?? '', oninput: emit, onchange: emit });
      return { input, el: h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('p', { class: 'hint', text: hint }) : null) };
    };
    const p = field('principal', '借款本金（NT$）', '1', loan.principal);
    const m = field('months', '期數（月）', '1', loan.months);
    const r = field('rate', '年利率（%）', '0.01', loan.rate);
    const result = h('p', { class: 'note loan-result', role: 'status' });
    const row = { inputs: { principal: p.input, months: m.input, rate: r.input }, result };
    row.el = h('div', { class: 'card loan-row' },
      h('div', { class: 'grid-form' }, p.el, m.el, r.el),
      result,
      h('button', { type: 'button', class: 'btn', text: '移除這筆貸款', onclick: () => { rows.splice(rows.indexOf(row), 1); row.el.remove(); emit(); } }),
    );
    rows.push(row);
    list.append(row.el);
  }

  addBtn.addEventListener('click', () => { add(); emit(); const last = rows.at(-1); last?.inputs.principal.focus(); });
  return {
    set(loans) {
      clear(list); rows.length = 0;
      for (const l of loans) add(l);
      // 只更新顯示文字，不回呼（避免重新填入時觸發 commit 迴圈）
      for (const r of rows) {
        const v = validateLoan({ principal: r.inputs.principal.value, months: r.inputs.months.value, rate: r.inputs.rate.value });
        if (v.ok) { const c = loanCost(v.value); r.result.textContent = `每月還款約 ${money(c.monthly)}（本金＋利息），總利息約 ${money(c.interest)}`; }
      }
      addBtn.disabled = rows.length >= MAX_LOANS;
    },
  };
}
