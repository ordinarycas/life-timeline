// 在首次繪製前套用已儲存的主題，避免閃一下。預設淺色；只有使用者選「自動」才跟隨系統。classic script（CSP script-src 'self' 不允許行內腳本）。
try {
  var p = JSON.parse(localStorage.getItem('ltl.prefs.v1') || 'null');
  var t = p && p.theme;
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
} catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
