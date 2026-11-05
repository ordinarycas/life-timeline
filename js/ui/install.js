// 安裝 App：Chromium 用 beforeinstallprompt；iOS Safari 沒有這個事件，改顯示加入主畫面的步驟。
export function initInstall(btn, iosBox) {
  let deferred = null;
  const standalone = () => globalThis.matchMedia?.('(display-mode: standalone)').matches || globalThis.navigator.standalone === true;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (!standalone()) btn.hidden = false; });
  addEventListener('appinstalled', () => { deferred = null; btn.hidden = true; });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* 使用者關閉 */ }
    deferred = null; btn.hidden = true;
  });
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !standalone()) iosBox.hidden = false;
}
