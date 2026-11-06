// 右下角資訊卡：選取（點擊、觸控）標籤時顯示簡述與「看詳細說明與來源」；沒選取時顯示目前狀態摘要。
import { h, clear } from './dom.js';
import { KINDS } from '../data/tags.js';
import { ageText, years1, money, yearAt, lvText } from '../core/format.js';
import { rowRange, stateText } from './timeline.js';

export function renderInfo(root, { row, model, kpi, chances = [], owned = false, onOwn = null, onClose, collapsed = false, onToggle = () => {} }) {
  clear(root);
  root.classList.toggle('is-collapsed', collapsed);
  const toggle = h('button', { type: 'button', class: 'xbtn', 'aria-expanded': String(!collapsed), 'aria-label': collapsed ? '展開資訊卡' : '收合資訊卡', text: collapsed ? '＋' : '－', onclick: onToggle });
  if (collapsed) {
    root.append(h('h3', {}, h('span', { text: row ? row.label : `LV ${lvText(model.lv)}` }), toggle));
    return;
  }
  if (!row) {
    root.append(...[
      h('h3', {}, h('span', { text: `LV ${lvText(model.lv)}` }), toggle),
      h('p', { text: `平均預期壽命 ${ageText(model.endAge)} 歲，還有約 ${years1(model.lifeLeft)} 年；預計 ${model.retire} 歲退休。` }),
      chances.length ? h('p', {}, h('strong', { text: '這個年紀的機會：' }), chances.slice(0, 4).map((r) => r.label).join('、'), chances.length > 4 ? ` 等 ${chances.length} 項` : '') : null,
      kpi && kpi.monthly > 0 ? h('p', { class: 'meta', text: `金幣：以每月 ${money(kpi.monthly)} 估，退休前還能累積約 ${money(kpi.inc.income)}。` }) : null,
      h('p', { class: 'meta', text: '點選或用鍵盤移到時間軸上的標籤，這裡會顯示說明。' }),
    ].filter(Boolean));
    return;
  }
  const years = model.demo || row.point ? '' : `（約 ${yearAt(model.birth, row.from)}–${yearAt(model.birth, row.to)} 年）`;
  root.append(...[
    h('h3', {}, h('span', { text: row.label }), h('span', { class: 'hd-btns' }, toggle, h('button', { type: 'button', class: 'xbtn', 'aria-label': '取消選取', text: '×', onclick: onClose }))),
    h('p', { class: 'meta' }, h('span', { class: 'chip', text: KINDS[row.tag.kind] }), `${rowRange(row)}${years}｜${stateText(row.state, row.tag)}`),
    h('p', { text: row.short }),
    row.extra ? h('p', { class: 'meta', text: row.extra }) : null,
    row.tag.opportunity ? h('p', {}, h('strong', { text: '機會：' }), row.tag.opportunity) : null,
    row.tag.countries ? h('details', { class: 'mini' }, h('summary', { text: `可選擇的 ${row.tag.countries.rows.length} 個國家` }), h('p', { class: 'meta', text: row.tag.countries.rows.map((c) => c[0]).join('、') + '。名額、財力證明見詳細說明。' })) : null,
    onOwn && (row.tag.obtainable || row.tag.id === 'service-active') ? h('label', { class: 'own' }, h('input', { type: 'checkbox', checked: owned ? true : null, onchange: (e) => onOwn(row, e.target.checked) }), row.tag.id === 'service-active' ? '我已服完兵役（或已免役）' : '我已取得／達成') : null,
    row.tag.user ? null : h('p', {}, h('a', { href: `#tag-${row.id}`, text: '看詳細說明與來源' })),
  ].filter(Boolean));
}
