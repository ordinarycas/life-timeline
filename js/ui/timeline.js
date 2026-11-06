// 區塊 1 的時間軸：每個標籤一排，原生 button 以絕對定位放在年齡刻度上；寬度由 JS 計算（ResizeObserver 時重算）。
import { h, clear, css } from './dom.js';
import { KINDS } from '../data/tags.js';
import { ageText, rangeText, money } from '../core/format.js';
import { BASELINE_WAGE } from '../data/wage.js';
import { clampZoom, pinchZoom, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './zoom.js';
import { BASELINE_AGE } from '../core/lifetime.js';

const LEG = 30;          // 圖例高度
const FLAG_Y = LEG + 2;  // 「現在」「壽命」旗標
const BAR_Y = LEG + 26;  // 主橫條
const RULER_Y = LEG + 54;
const LANES_Y = LEG + 76;
const ROW_H = 32;
const PAD = 16;
const MIN_PPY = 9;       // 每年最少像素，不夠就在地圖內橫向捲動
export { ZOOM_MIN, ZOOM_MAX };
const STATE_TEXT = { past: '已走過', now: '進行中', future: '尚未到' };
const SEG_TEXT = { walked: '已走過', work: '工作期（至退休）', retired: '退休後' };

export const KIND_VAR = Object.freeze({
  money: '--k-money', stage: '--k-stage', work: '--k-work', license: '--k-license', exam: '--k-exam', retire: '--k-retire', service: '--k-service', risk: '--k-risk', kids: '--k-kids',
});

export function rowRange(row) {
  if (row.point) return rangeText(row.at);
  const r = rangeText(row.from, row.to);
  return row.ext ? `${r}（延伸到 ${ageText(row.ext.to)} 歲）` : r;
}
export function stateText(s, tag) {
  const chance = tag?.obtainable || tag?.openEnded;
  if (s === 'done') return '已取得';
  if (s === 'chance') return tag?.obtainable ? '機會（尚未取得）' : '機會（年齡已符合）';
  if (s === 'now') return tag?.nowLabel || (tag?.obtainable ? '機會' : STATE_TEXT.now);
  if (s === 'future' && chance) return '未來的機會';
  return STATE_TEXT[s];
}

/**
 * @param {{map:HTMLElement, tl:HTMLElement, legend:HTMLElement, special:HTMLElement, mainbar:HTMLElement, decades:HTMLElement, lanes:HTMLElement, tip:HTMLElement}} els
 * @param {{onSelect:(row:object|null)=>void, onJump:(id:string)=>void}} cb
 */
export function createTimeline(els, cb) {
  const st = { model: null, expanded: false, selected: null, forcedWidth: null, timers: {}, buttons: new Map(), zoom: 1, mile: null };

  function width() { return st.forcedWidth ?? (els.map.clientWidth || 960); }

  function render(model) {
    if (model) st.model = model;
    const m = st.model;
    if (!m) return;
    st.buttons.clear();
    [els.legend, els.special, els.mainbar, els.decades, els.lanes].forEach(clear);
    st.mile = null;
    hideTip();

    const W = width();
    const zoom = st.forcedWidth ? 1 : st.zoom;
    const ppy = Math.max((W - PAD * 2) / m.endAge, MIN_PPY) * zoom;
    st.ppy = ppy;
    const totalW = Math.ceil(PAD * 2 + ppy * m.endAge);
    const x = (age) => PAD + age * ppy;
    css(els.tl, { width: Math.max(totalW, st.forcedWidth ?? 0) });

    const visible = [];
    if (m.milestones?.length) visible.push({ milestones: true });
    if (m.past.length) visible.push({ toggle: true });
    for (const r of m.rows) if (!(r.state === 'past' || r.state === 'done') || st.expanded) visible.push(r);
    const lanesH = visible.length * ROW_H;
    const totalH = LANES_Y + lanesH + 90;
    css(els.tl, { height: totalH });
    for (const e of [els.special, els.mainbar, els.decades, els.lanes]) css(e, { height: totalH });

    // 圖例：只列出實際出現的類型
    const kinds = [...new Set(m.rows.map((r) => r.tag.kind))];
    for (const k of kinds) els.legend.append(h('span', { class: 'lg' }, css(h('i'), { '--c': `var(${KIND_VAR[k]})` }), KINDS[k]));
    els.legend.append(h('span', { class: 'lg past' }, h('i'), '已走過／已取得'), h('span', { class: 'lg now' }, h('i'), '進行中／機會'), h('span', { class: 'lg fut' }, h('i'), '尚未到'));

    // 刻度
    for (let a = 0; a <= m.endAge; a += 10) {
      els.decades.append(css(h('div', { class: 'tick' }), { left: x(a), top: RULER_Y, height: totalH - RULER_Y }));
      els.decades.append(css(h('div', { class: 'tick-label', text: `${a}` }), { left: x(a), top: RULER_Y - 2 }));
    }
    // 主橫條
    for (const s of m.bars) {
      const seg = h('div', { class: `seg seg-${s.key}`, text: SEG_TEXT[s.key] });
      css(seg, { left: x(s.from), width: Math.max((s.to - s.from) * ppy, 4), top: BAR_Y });
      els.mainbar.append(seg);
    }
    // 現在線與壽命旗標
    const nowX = x(m.age);
    els.special.append(css(h('div', { class: 'today' }), { left: nowX, top: BAR_Y - 4, height: totalH - BAR_Y + 4 }));
    const nowFlag = h('div', { class: `flag flag-today${nowX > totalW - 150 ? ' left' : ''}`, text: `現在 ${ageText(m.age)} 歲` });
    els.special.append(css(nowFlag, { left: nowX, top: FLAG_Y }));
    const endX = x(m.endAge);
    const endFlag = h('div', { class: 'flag left', text: `平均預期壽命 ${ageText(m.endAge)} 歲` });
    if (Math.abs(endX - nowX) > 190) els.special.append(css(endFlag, { left: endX, top: FLAG_Y }));

    // 各排
    let i = 0;
    for (const item of visible) {
      const top = LANES_Y + i * ROW_H;
      i++;
      if (item.milestones) { els.lanes.append(mileRow(m, top, x, totalW)); continue; }
      if (item.toggle) { els.lanes.append(pastToggle(m, top, x)); continue; }
      els.lanes.append(rowEl(item, top, x, totalW));
    }
    css(els.tip, {});
    if (st.selected) mark(st.selected, true);
    if (!st.scrolled && !st.forcedWidth) { st.scrolled = true; els.map.scrollLeft = Math.max(0, nowX - els.map.clientWidth * 0.3); }
  }

  // 從 18 歲起只領基本工資的累積里程：100 萬、500 萬、1000 萬、1500 萬各一個金幣（可點擊或觸控看說明）
  function mileRow(m, top, x, totalW) {
    const row = h('div', { class: 'row mile-row' });
    css(row, { top });
    m.milestones.forEach((ms, i) => {
      const text = `${ms.amount / 10000} 萬`;
      const reached = ms.age <= m.age;
      const key = `mile-${ms.amount}`;
      const info = {
        key, title: `基本收入累積 ${text}`,
        meta: `約 ${ageText(ms.age)} 歲｜${reached ? '已達到' : '尚未到'}`,
        text: `從 ${BASELINE_AGE} 歲起只領基本工資（今天的 ${money(BASELINE_WAGE)}／月），約 ${ageText(ms.age)} 歲累積到 ${text}。不含稅費與物價變動，是估算，不是保證。`,
      };
      const aria = `${info.title}，${info.meta}`;
      const coin = h('button', { type: 'button', class: `mile${reached ? ' is-reached' : ''}`, 'aria-label': aria, dataset: { id: key } });
      css(coin, { left: x(ms.age) - 11 });
      // 標籤放得下才帶年齡，否則只寫金額（完整說明在提示框）
      const next = m.milestones[i + 1];
      const room = next ? x(next.age) - x(ms.age) - 26 : totalW - x(ms.age) - 14;
      const full = `${text}（${ageText(ms.age)} 歲）`;
      const label = [...full].length * 13 + 8 <= room ? full : text;
      const lbl = h('span', { class: 'lbl', text: label, 'aria-hidden': 'true' });
      const est = [...label].length * 13 + 14;
      if (x(ms.age) + 12 + est > totalW) css(lbl, { right: totalW - x(ms.age) + 12 }); else css(lbl, { left: x(ms.age) + 12 });
      wireMile(coin, info, top, x(ms.age) - 11);
      st.buttons.set(key, coin);
      row.append(coin, lbl);
    });
    row.append(css(h('span', { class: 'mile-title', text: '基本收入累積' }), { left: x(BASELINE_AGE) - 4 - 84 }));
    return row;
  }

  function wireMile(btn, info, top, leftX) {
    btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showInfo(info, top, leftX, 100); });
    btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && st.mile !== info.key) hideTip(150); });
    btn.addEventListener('focus', () => showInfo(info, top, leftX, 0));
    btn.addEventListener('blur', () => { if (st.mile !== info.key) hideTip(0); });
    btn.addEventListener('click', () => {
      if (st.mile === info.key) { st.mile = null; hideTip(0); } else { st.mile = info.key; showInfo(info, top, leftX, 0); }
    });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Escape') { st.mile = null; hideTip(0); } });
  }

  function pastToggle(m, top, x) {
    const label = st.expanded ? `收合已走過的階段（${m.past.length} 項）` : `已走過的階段（${m.past.length} 項）`;
    const btn = h('button', {
      type: 'button', class: 'past-toggle', 'aria-expanded': String(st.expanded), 'aria-controls': 'tl-lanes',
      onclick: () => { st.expanded = !st.expanded; render(); focusToggle(); },
    }, h('span', { class: 'past-txt', text: `${st.expanded ? '▾' : '▸'} ${label}` }));
    css(btn, { left: x(0), width: Math.max(x(m.pastTo) - x(0), 190) });
    const row = h('div', { class: 'row' }, btn);
    css(row, { top });
    return row;
  }
  function focusToggle() { els.lanes.querySelector('.past-toggle')?.focus(); }

  function rowEl(r, top, x, totalW) {
    const cls = `is-${r.state}`;
    const color = `var(${KIND_VAR[r.tag.kind]})`;
    const aria = `${r.label}，${rowRange(r)}，${stateText(r.state, r.tag)}`;
    let btn; let leftX; let rightX;
    if (r.point) {
      btn = h('button', { type: 'button', class: `dot ${cls}`, 'aria-label': aria, dataset: { id: r.id } });
      css(btn, { left: x(r.at) - 11, '--c': color });
      leftX = x(r.at) - 11; rightX = x(r.at) + 11;
    } else {
      const reach = r.ext ? r.ext.to : r.to;
      const w = Math.max((reach - r.from) * (x(1) - x(0)), 26);
      btn = h('button', { type: 'button', class: `bar ${cls}`, 'aria-label': aria, dataset: { id: r.id } });
      const mainW = r.ext ? Math.max(((r.to - r.from) / (reach - r.from)) * w, 4) : w;
      btn.append(css(h('span', { class: 'fill' }), { width: mainW }));
      if (r.ext) btn.append(css(h('span', { class: 'ext' }), { width: w - mainW }));
      css(btn, { left: x(r.from), width: w, '--c': color });
      leftX = x(r.from); rightX = x(r.from) + w;
    }
    const lbl = h('span', { class: 'lbl', text: r.label, 'aria-hidden': 'true' });
    const est = [...r.label].length * 13 + 14;
    if (rightX + 6 + est > totalW && leftX - 6 - est > 0) css(lbl, { right: totalW - leftX + 6 });
    else css(lbl, { left: rightX + 6 });
    const row = h('div', { class: `row ${cls}` }, btn, lbl);
    css(row, { top });
    wire(btn, r, top, leftX);
    st.buttons.set(r.id, btn);
    return row;
  }

  function wire(btn, r, top, leftX) {
    btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(r, top, leftX, 100); });
    btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && st.selected?.id !== r.id) hideTip(150); });
    btn.addEventListener('focus', () => showTip(r, top, leftX, 0));
    btn.addEventListener('blur', () => { if (st.selected?.id !== r.id) hideTip(0); });
    btn.addEventListener('click', (e) => {
      if (e.detail === 0) { select(r); cb.onJump(r.id); return; } // 鍵盤 Enter／Space：跳到區塊 3
      if (st.selected?.id === r.id) select(null); else { select(r); showTip(r, top, leftX, 0); }
    });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Escape') { select(null); hideTip(0); } });
  }

  function showTip(r, top, leftX, delay) {
    st.mile = null;
    showInfo({ key: r.id, title: r.label, meta: `${rowRange(r)}｜${stateText(r.state, r.tag)}`, text: r.short }, top, leftX, delay);
  }
  function showInfo(info, top, leftX, delay) {
    clearTimeout(st.timers.tip);
    st.timers.tip = setTimeout(() => {
      clear(els.tip);
      els.tip.append(h('strong', { text: info.title }), info.meta, h('br'), info.text);
      els.tip.hidden = false;
      const w = els.tl.clientWidth;
      css(els.tip, { left: Math.min(Math.max(leftX, 8), Math.max(w - 262, 8)), top: top + ROW_H + 2 });
      for (const b of st.buttons.values()) b.removeAttribute('aria-describedby');
      st.buttons.get(info.key)?.setAttribute('aria-describedby', 'tl-tip');
    }, delay);
  }
  function hideTip(delay = 0) {
    clearTimeout(st.timers.tip);
    st.timers.tip = setTimeout(() => {
      els.tip.hidden = true;
      for (const b of st.buttons.values()) b.removeAttribute('aria-describedby');
    }, delay);
  }

  function mark(row, on) {
    const b = st.buttons.get(row.id);
    if (b) b.classList.toggle('is-sel', on);
  }
  function select(row) {
    if (st.selected) mark(st.selected, false);
    st.selected = row;
    if (row) mark(row, true); else hideTip(0);
    cb.onSelect(row);
  }

  els.tip.id = 'tl-tip';
  document.addEventListener('pointerdown', (e) => {
    if (st.mile && !e.target.closest?.('.mile')) { st.mile = null; hideTip(0); }
  });

  // ---- 縮放：按鈕、Ctrl＋滾輪（含觸控板雙指）、手機雙指。以畫面上的某個點為錨，縮放後那個年齡仍在原位 ----
  let raf = 0; let pending = null;
  function setZoom(z, clientX) {
    const next = clampZoom(z);
    if (next === st.zoom) return;
    const rect = els.map.getBoundingClientRect();
    const cx = clientX == null ? els.map.clientWidth / 2 : clientX - rect.left;
    const age = (els.map.scrollLeft + cx - PAD) / (st.ppy || 1);
    st.zoom = next;
    render();
    els.map.scrollLeft = PAD + age * st.ppy - cx;
    cb.onZoom?.(next);
  }
  function scheduleZoom(z, clientX) {
    pending = { z, clientX };
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const p = pending; pending = null; if (p) setZoom(p.z, p.clientX); });
  }
  els.map.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    scheduleZoom(st.zoom * Math.exp(-e.deltaY * 0.01), e.clientX);
  }, { passive: false });
  let pinch = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  els.map.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = { d: dist(e.touches), z: st.zoom };
  }, { passive: true });
  els.map.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !pinch) return;
    if (e.cancelable) e.preventDefault();
    scheduleZoom(pinchZoom(pinch.z, pinch.d, dist(e.touches)), (e.touches[0].clientX + e.touches[1].clientX) / 2);
  }, { passive: false });
  const endPinch = (e) => { if (e.touches.length < 2) pinch = null; };
  els.map.addEventListener('touchend', endPinch, { passive: true });
  els.map.addEventListener('touchcancel', endPinch, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.selected) select(null); });
  if (globalThis.ResizeObserver) {
    let last = 0;
    new ResizeObserver(() => {
      const w = els.map.clientWidth;
      if (w !== last && !st.forcedWidth) { last = w; render(); }
    }).observe(els.map);
  }

  return {
    render,
    select,
    get model() { return st.model; },
    get zoom() { return st.zoom; },
    zoomBy(f) { setZoom(st.zoom * f); },
    zoomReset() { setZoom(1); },
    /** 展開已走過的階段（列印時用）。回傳先前狀態。 */
    setExpanded(v) { const prev = st.expanded; st.expanded = v; render(); return prev; },
    /** 固定版面寬度（列印用）；null 還原。 */
    setForcedWidth(w) { st.forcedWidth = w; render(); },
    get selected() { return st.selected; },
    reselect(id) { const r = st.model?.rows.find((x) => x.id === id) ?? null; select(r); },
  };
}
