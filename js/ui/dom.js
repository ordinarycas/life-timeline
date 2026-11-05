// 極小的 DOM 工具：一律用 textContent／setAttribute，不使用 innerHTML（CSP 與 XSS 防線）。
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** h('div', {class:'x', text:'hi', onclick:fn, dataset:{a:1}, 'aria-label':'…'}, child1, 'text') */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function clear(el) { el.replaceChildren(); return el; }

/** CSSOM 設定樣式（不是 style 屬性字串，CSP 允許）。 */
export function css(el, props) {
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('--')) el.style.setProperty(k, v);
    else el.style[k] = typeof v === 'number' ? `${v}px` : v;
  }
  return el;
}

export function toast(msg, ms = 4000) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: 'toast', text: msg });
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
