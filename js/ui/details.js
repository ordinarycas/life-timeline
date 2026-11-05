// 區塊 3：每個標籤的詳細說明、本站假設與資料來源（含查閱日期）。
import { h, clear } from './dom.js';
import { showTab } from './tabs.js';
import { TAGS, KINDS, appliesTo } from '../data/tags.js';
import { rowRange } from './timeline.js';
import { LIFE_TABLE } from '../core/lifetime.js';
import { WAGE_SOURCE } from '../data/wage.js';

const link = (s) => h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: `${s.publisher}《${s.title}》` });

export function renderDetails(listEl, generalEl, model) {
  // 重畫前記住哪些卡片是展開的（設定改變時不要全部闔上）
  const openIds = new Set([...listEl.querySelectorAll('details.tagcard[open]')].map((d) => d.id.slice(4)));
  clear(listEl);
  for (const tag of TAGS) {
    if (!appliesTo(tag, model.sex)) continue;
    const row = model.rows.find((r) => r.id === tag.id);
    const where = tag.draw === false ? '不畫在時間軸上（選了對應的役別才會用到）' : row ? `時間軸位置：${rowRange(row)}` : '在你目前的設定下，沒有畫在時間軸上';
    const extra = tag.detailBy?.[model.sex] ?? [];
    const open = openIds.has(tag.id);
    listEl.append(h('details', { class: 'tagcard', id: `tag-${tag.id}`, open: open ? true : null },
      h('summary', {}, h('h3', { text: tag.label }), h('span', { class: 'sum-meta' }, h('span', { class: 'chip', text: KINDS[tag.kind] }), where)),
      h('div', { class: 'body' },
        h('p', { text: tag.short }),
        ...tag.detail.map((t) => h('p', { text: t })),
        ...extra.map((t) => h('p', { text: t })),
        tag.opportunity ? h('p', { class: 'assume' }, h('strong', { text: '這個年紀的機會：' }), tag.opportunity, '（本站依上述法規整理，不是就業或收入保證。）') : null,
        tag.countries ? countriesBlock(tag.countries) : null,
        tag.assumption ? h('p', { class: 'assume' }, h('strong', { text: '本站假設：' }), tag.assumption) : null,
        h('p', { class: 'src-title', text: '資料來源' }),
        h('ul', { class: 'src-list' }, tag.sources.map((s) => h('li', {}, link(s), `（${s.role === 'primary' ? '官方來源' : '輔助參考'}，查閱 ${s.accessed}）`))),
      ),
    ));
  }
  clear(generalEl.querySelector('ul')).append(
    h('li', {}, '平均餘命：', h('a', { href: LIFE_TABLE.url, target: '_blank', rel: 'noopener noreferrer', text: LIFE_TABLE.source }), '。每 10 歲一點，中間以線性內插；它是同年齡、同性別人口的平均，不是對你個人壽命的預測。'),
    h('li', {}, '基本工資：', h('a', { href: WAGE_SOURCE.url, target: '_blank', rel: 'noopener noreferrer', text: `${WAGE_SOURCE.publisher}《${WAGE_SOURCE.title}》` }), `（查閱 ${WAGE_SOURCE.accessed}）。2027 年數字為審議會決議，尚待行政院核定。`),
    h('li', {}, '收入算法：月收入 × 12 × 到退休的年數，以今天的新台幣計、稅前，不含調薪、通膨與退休金。'),
    h('li', {}, '育兒區間以 18 年計（《民法》第 12 條成年年齡），為本站簡化假設。'),
  );
}

function countriesBlock(c) {
  const th = (t) => h('th', { scope: 'col', text: t });
  return h('details', { class: 'countries' },
    h('summary', { text: `展開：${c.title}` }),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, c.columns.map(th))),
      h('tbody', {}, c.rows.map((r) => h('tr', {}, h('th', { scope: 'row', text: r[0] }), ...r.slice(1).map((x) => h('td', { text: x || '—' }))))))),
    h('p', { class: 'meta', text: c.note }),
  );
}

/** 從時間軸跳到對應的詳細說明（鍵盤 Enter 與資訊卡連結）。 */
export function jumpToTag(id) {
  const el = document.getElementById(`tag-${id}`);
  if (!el) return;
  showTab('details', { scroll: false }); // 手機分頁：先切到「說明」才找得到卡片
  el.open = true;
  history.replaceState(null, '', `#tag-${id}`);
  el.scrollIntoView({ block: 'start' });
  el.querySelector('summary')?.focus({ preventScroll: true });
}

/** 全部展開或全部收合。 */
export function setAllCards(listEl, open) { listEl.querySelectorAll('details.tagcard').forEach((d) => { d.open = open; }); }
