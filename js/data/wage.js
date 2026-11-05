// 基本工資（勞動部）：資料在 wage.json。2027 年數字為審議會決議，尚待行政院核定；2026 年現行數字待複核（規格 §3.1）。
export let WAGE_SOURCE = Object.freeze({});
export let WAGE = Object.freeze({});
/** 「18 歲起領基本工資」對照固定用現行基本工資。 */
export let BASELINE_WAGE = 0;

export function initWage(data) {
  WAGE_SOURCE = Object.freeze(data.source);
  WAGE = Object.freeze(Object.fromEntries(Object.entries(data.wage).map(([k, v]) => [k, Object.freeze(v)])));
  BASELINE_WAGE = WAGE.current.monthly;
}

/** 依偏好設定換算月收入（NT$）。 */
export function monthlyFromPrefs(prefs) {
  if (prefs.wage === 'custom') return Math.max(Math.round(Number(prefs.monthly) || 0), 0);
  return (WAGE[prefs.wage] ?? WAGE.current).monthly;
}
