// 平均餘命：內政部第十一次國民生命表（民國 108～110 年），資料在 life-table.json。
// 數字沿用兄弟專案 balance-sheet，尚未對照內政部原表（規格 §3.1）。單一歲數以相鄰兩個十歲點線性內插；平均餘命是同年齡、同性別人口的平均，不是對個人壽命的預測。
export let LIFE_TABLE = Object.freeze({ male: [[0, 0], [10, 0], [100, 0]], female: [[0, 0], [10, 0], [100, 0]] });
/** 較新的「114 年簡易生命表」平均壽命（歲），僅供對照。 */
export let LATEST_ABRIDGED = Object.freeze({});
export function initLifeTable(data) {
  LIFE_TABLE = Object.freeze(data.table);
  LATEST_ABRIDGED = Object.freeze(data.latestAbridged);
}
