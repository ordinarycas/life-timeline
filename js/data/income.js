// 收入資源（income.json）：不同工作類型的條件與預估薪資。預估值來自本站作者的參考頁面，不是官方統計。
export let INCOME = Object.freeze({ source: {}, note: '', groups: [] });
export function initIncome(data) { INCOME = Object.freeze(data); }
