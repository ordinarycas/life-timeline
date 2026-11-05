// 直向手機：建議橫向觀看時間軸（可關閉，記在 ltl.hints.v1）。不使用 screen.orientation.lock。
// hints 與 setHint 由 app.js 提供，讓不同提示共用同一份狀態，不會互相覆蓋。
export function initHints(bar, okBtn, hints, setHint) {
  const mq = globalThis.matchMedia?.('(orientation: portrait) and (max-width: 600px)');
  const sync = () => { bar.hidden = !(mq?.matches && !hints.landscapeDismissed); };
  okBtn.addEventListener('click', () => { setHint('landscapeDismissed', true); sync(); });
  mq?.addEventListener?.('change', sync);
  sync();
}
