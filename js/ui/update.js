// 檢查更新：向網路抓 build.js（no-store、加 ?check= 繞過 Service Worker），比對 BUILD_ID。套用時等新 Service Worker 啟用後重新載入。
import { BUILD_ID } from '../core/build.js';

const RE_ID = /BUILD_ID\s*=\s*'([^']+)'/;

/** @returns {Promise<'new'|'same'|'error'>} */
export async function checkForUpdate() {
  try {
    const res = await fetch(new URL(`js/core/build.js?check=${Date.now()}`, document.baseURI), { cache: 'no-store' });
    if (!res.ok) return 'error';
    const id = RE_ID.exec(await res.text())?.[1];
    if (!id) return 'error';
    return id === BUILD_ID ? 'same' : 'new';
  } catch { return 'error'; }
}

/** 套用更新：請 SW 更新，新版啟用（controllerchange）後重新載入；沒有 SW 就直接重新載入。 */
export async function applyUpdate(reg) {
  if (!reg) { location.reload(); return; }
  const changed = new Promise((res) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => res(), { once: true });
    setTimeout(res, 8000);
  });
  try { await reg.update(); } catch { /* 離線時略過 */ }
  if (!reg.installing && !reg.waiting) { location.reload(); return; }
  await changed;
  location.reload();
}

export async function registerSW(enabled) {
  if (!enabled || !('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('sw.js'); } catch { return null; }
}

/** 本機 http 預設不註冊（避免快取干擾開發）；HTTPS 一律註冊；本機加 ?sw=1 也註冊。 */
export function swEnabled() {
  return location.protocol === 'https:' || new URLSearchParams(location.search).get('sw') === '1';
}
