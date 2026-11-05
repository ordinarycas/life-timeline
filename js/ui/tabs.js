// 手機直向的分頁：body[data-tab] 決定顯示哪一組區塊（CSS 只在窄螢幕套用，桌面與列印全部顯示）。
export const TABS = Object.freeze(['timeline', 'settings', 'chances', 'details']);

export function showTab(name, { scroll = true } = {}) {
  if (!TABS.includes(name)) return;
  document.body.dataset.tab = name;
  for (const b of document.querySelectorAll('#bottomnav button')) {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  if (scroll) scrollTo({ top: 0 });
}

export function initTabs(nav, { onChange = () => {} } = {}) {
  document.body.dataset.tab = 'timeline';
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    showTab(b.dataset.tab);
    onChange(b.dataset.tab);
  });
}
