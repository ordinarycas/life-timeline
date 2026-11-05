// 日期工具（純函式）。「今天」一律以台北時間（UTC+8）計。
export const TAIPEI_OFFSET_MS = 8 * 3600e3;
export const DAY_MS = 86400000;

/** 台北日期 YYYY-MM-DD；可注入時間（毫秒）方便測試。 */
export function todayTaipei(now = Date.now()) {
  return new Date(now + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

/** 是否為真實存在的日期（例如 2026-02-30 為 false）。 */
export function isValidIso(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** 台北「今天」往前 years 年的同月同日（2/29 → 2/28）。 */
export function yearsAgo(todayIso, years) {
  const [y, m, d] = todayIso.split('-').map(Number);
  const dd = m === 2 && d === 29 ? 28 : d;
  return `${String(y - years).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
