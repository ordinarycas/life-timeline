// 主題：auto（跟隨系統）／light／dark。data-theme 屬性由 theme-init.js 先行套用，這裡負責切換與同步。
const ORDER = ['light', 'dark', 'auto'];
const LABEL = { auto: '主題：自動', light: '主題：淺色', dark: '主題：深色' };

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

export function nextTheme(t) { return ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]; }

export function initTheme(btn, current, onChange) {
  let theme = current;
  const sync = () => { applyTheme(theme); btn.textContent = LABEL[theme]; };
  sync();
  btn.addEventListener('click', () => { theme = nextTheme(theme); sync(); onChange(theme); });
  // 系統深淺色改變時，若為自動就通知重畫（圖表顏色來自 CSS 變數）
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (theme === 'auto') onChange(theme); });
}
