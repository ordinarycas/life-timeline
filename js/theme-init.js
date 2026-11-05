// 在首次繪製前套用已儲存的主題，避免閃一下淺色。classic script（CSP script-src 'self' 不允許行內腳本）。
try {
  var p = JSON.parse(localStorage.getItem('ltl.prefs.v1') || 'null');
  var t = p && p.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* 無法使用 localStorage：維持 auto */ }
