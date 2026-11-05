// 顯示用格式（純函式）。金額為新台幣、千分位整數；年數一位小數。
export const money = (n) => `NT$${Math.round(n).toLocaleString('en-US')}`;
export const signedMoney = (n) => (Math.round(n) > 0 ? '＋' : Math.round(n) < 0 ? '－' : '') + money(Math.abs(n));
export const years1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

/** LV 等級：年齡取到小數點 2 位（無條件捨去，所以生日當天才進位）。 */
export const lvText = (lv) => Number(lv).toFixed(2);

/** 歲數：整數就不帶小數，否則一位小數。 */
export function ageText(a) {
  const r = Math.round(a * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** 區間文字：「15–18 歲」；單點「18 歲」。 */
export function rangeText(from, to) {
  return to == null || to === from ? `${ageText(from)} 歲` : `${ageText(from)}–${ageText(to)} 歲`;
}

/** 公元年份（由出生日加上歲數估算）。 */
export function yearAt(birthIso, age) {
  return Math.round(Number(birthIso.slice(0, 4)) + age);
}
