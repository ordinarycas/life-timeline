// Service Worker：讓網站安裝後可離線使用。
// 同源只處理 GET；唯一的跨網域例外是 Google Fonts 的兩個網域（字型樣式與檔案），存在獨立快取 ltl-fonts-v1，離線時仍有字型。
// 下方 PRECACHE 區塊由 `npm run gen:sw` 產生（含內容雜湊的版本號）；tests/pwa.test.js 會檢查它是否過期。
// === PRECACHE:BEGIN ===
const VERSION = 'ltl-385caf9740';
const PRECACHE = [
  "./",
  "./advanced.html",
  "./css/style.css",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./js/advanced.js",
  "./js/app.js",
  "./js/core/advanced.js",
  "./js/core/assets.js",
  "./js/core/build.js",
  "./js/core/clock.js",
  "./js/core/format.js",
  "./js/core/kpi.js",
  "./js/core/lifetime.js",
  "./js/core/loans.js",
  "./js/core/market.js",
  "./js/core/military.js",
  "./js/core/placement.js",
  "./js/core/youtube.js",
  "./js/data/income.js",
  "./js/data/income.json",
  "./js/data/life-table.js",
  "./js/data/life-table.json",
  "./js/data/loader.js",
  "./js/data/music.js",
  "./js/data/music.json",
  "./js/data/prefs.js",
  "./js/data/rules.js",
  "./js/data/tags.js",
  "./js/data/tags.json",
  "./js/data/wage.js",
  "./js/data/wage.json",
  "./js/theme-init.js",
  "./js/ui/assets.js",
  "./js/ui/details.js",
  "./js/ui/dom.js",
  "./js/ui/fonts.js",
  "./js/ui/footer.js",
  "./js/ui/hints.js",
  "./js/ui/income.js",
  "./js/ui/incomecurve.js",
  "./js/ui/infocard.js",
  "./js/ui/install.js",
  "./js/ui/loans.js",
  "./js/ui/player.js",
  "./js/ui/print.js",
  "./js/ui/settings.js",
  "./js/ui/tabs.js",
  "./js/ui/theme.js",
  "./js/ui/timeline.js",
  "./js/ui/update.js",
  "./manifest.webmanifest",
  "./vendor/chart.umd.min.js"
];
// === PRECACHE:END ===

const FONT_CACHE = 'ltl-fonts-v1';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const VERSIONED = /^ltl-[0-9a-f]{10}$/; // 版本快取；ltl-fonts-v1 不符合，所以不會被清掉

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => VERSIONED.test(k) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Google Fonts：先用快取、同時在背景更新（以 CORS 模式取得，避免 opaque 回應佔用大量儲存配額）。離線且沒快取時回傳網路錯誤，頁面改用系統字型。
async function fontResponse(url) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(url);
  const refresh = fetch(url, { mode: 'cors', credentials: 'omit' }).then((res) => { if (res.ok) cache.put(url, res.clone()); return res; });
  if (hit) { refresh.catch(() => {}); return hit; }
  return refresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.has(url.hostname) && url.protocol === 'https:') { e.respondWith(fontResponse(req.url)); return; }
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('check')) return; // 「檢查更新」直接走網路，不讀也不寫快取

  // 頁面導覽：優先走網路（拿到最新版），離線時退回快取的外殼
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))));
    return;
  }
  // 其他同源資源：先用快取（快、可離線），同時在背景更新；沒預先快取的（如音檔）首次使用後也會被存起來
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
      if (hit) { refresh.catch(() => {}); return hit; }
      return refresh;
    }),
  );
});
