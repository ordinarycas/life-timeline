// Google Fonts：動態插入樣式表（不阻擋首次繪製；失敗時沿用系統字型）。
// 隱私：載入時 Google 會收到 IP 與瀏覽器資訊，不會收到使用者輸入的資料（頁尾與設定區有說明）。
const URL_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap';

export function loadFonts() {
  if (document.querySelector('link[data-ltl-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = URL_CSS;
  link.dataset.ltlFonts = '1';
  link.addEventListener('error', () => link.remove());
  document.head.append(link);
}

/** 列印前等字型載入（最多等 2 秒）。 */
export function fontsReady(ms = 2000) {
  const ready = document.fonts?.ready ?? Promise.resolve();
  return Promise.race([ready, new Promise((r) => setTimeout(r, ms))]);
}
