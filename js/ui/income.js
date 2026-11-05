// 收入資源：各類工作的條件與預估薪資（income.json）。預估值不是官方統計；職業駕照類會顯示使用者是否已勾選職業駕照。
import { h, clear } from './dom.js';
import { INCOME } from '../data/income.js';

export function renderIncome(listEl, leadEl, have) {
  clear(listEl); clear(leadEl);
  const src = INCOME.source;
  leadEl.append(INCOME.note, ' 資料整理自 ', h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', text: `${src.title}（${src.publisher}）` }), `，查閱 ${src.accessed}。`);
  const th = (t) => h('th', { scope: 'col', text: t });
  for (const g of INCOME.groups) {
    const badge = g.needs ? (have.includes(g.needs) ? '你已勾選職業駕照' : '需要先取得職業駕照') : null;
    listEl.append(h('details', { class: 'card income-group', id: `income-${g.id}` },
      h('summary', {}, h('span', { class: 'sum-title', text: g.title }), badge ? h('span', { class: 'badge', text: badge }) : null, h('span', { class: 'sum-line', text: `${g.jobs.length} 類職缺` })),
      h('p', { class: 'intro', text: g.intro }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data-table income-table' },
        h('thead', {}, h('tr', {}, (g.labels ?? ['職缺', '條件', '預估薪資（新台幣、稅前）', '備註']).map(th))),
        h('tbody', {}, g.jobs.map((j) => h('tr', {}, h('th', { scope: 'row', text: j.job }), h('td', { text: j.condition }), h('td', { class: 'pay', text: j.pay }), h('td', { text: j.note })))))),
      g.sources ? h('div', {}, h('p', { class: 'src-title', text: '本組官方來源' }), h('ul', { class: 'src-list' }, g.sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: `${s.publisher}：${s.title}` }), `（查閱 ${s.accessed}）`)))) : null,
    ));
  }
}
