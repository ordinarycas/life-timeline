// 時間軸縮放的純函式：倍率限制與雙指縮放換算。
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 1.25;

/** 限制在 1～4 倍；非數字回到 1。 */
export function clampZoom(z) {
  if (!Number.isFinite(z)) return 1;
  return Math.round(Math.min(Math.max(z, ZOOM_MIN), ZOOM_MAX) * 100) / 100;
}

/** 雙指縮放：手指距離變為幾倍，倍率就乘幾倍。 */
export function pinchZoom(startZoom, startDist, dist) {
  if (!(startDist > 0) || !(dist > 0)) return startZoom;
  return clampZoom(startZoom * (dist / startDist));
}
