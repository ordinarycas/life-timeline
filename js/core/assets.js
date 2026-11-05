// 資產負債代入（純函式）：把「人生最低收入」加上目前的資產、扣掉借款與餘命內的固定支出，看看還剩多少。
// 假設：金額固定、以今天的新台幣計；不含通膨、投資報酬、退休金與勞保年金、自住不動產的居住價值。不是理財建議。

export const ASSET_KEYS = ['assetCash', 'assetInvest', 'assetOther', 'debt', 'debtInterest', 'expense'];

/** 有沒有填任何資產、借款或支出（全部是 0 就不顯示這一區的結果）。 */
export const hasAssetInput = (p) => ASSET_KEYS.some((k) => Number(p[k]) > 0);

/**
 * @param {{income:number, lifeMonths:number, monthly:number}} base 人生最低收入（退休前累積）、剩餘月數、月收入
 * @param {{assetCash:number, assetInvest:number, assetOther:number, debt:number, debtInterest:number, expense:number}} p
 */
export function computeAssets(base, p) {
  const n = (k) => Math.max(Math.round(Number(p[k]) || 0), 0);
  const assets = n('assetCash') + n('assetInvest') + n('assetOther');
  const debts = n('debt') + n('debtInterest');
  const expense = n('expense');
  const income = Math.round(base.income);
  const lifeMonths = Math.max(base.lifeMonths, 1);
  const resources = income + assets - debts;           // 還清借款後的總資源
  const lifeExpense = expense * lifeMonths;            // 餘命內固定支出（假設不變）
  const surplus = resources - lifeExpense;             // 餘裕（負數是缺口）
  // 資源增減圖的步驟：delta 為這一步的增減，total 為累計；kind 決定畫法
  const steps = [
    { key: 'income', label: '人生最低收入', sign: '', value: income, from: 0, to: income, kind: 'total' },
    { key: 'assets', label: '資產（存款、投資、其他）', sign: '＋', value: assets, from: income, to: income + assets, kind: 'pos' },
    { key: 'debts', label: '尚未償還的借款（本金＋預估利息）', sign: '－', value: debts, from: income + assets, to: resources, kind: 'neg' },
    { key: 'resources', label: '還清借款後的總資源', sign: '＝', value: resources, from: 0, to: resources, kind: 'total' },
    { key: 'expense', label: '餘命內固定支出（假設不變）', sign: '－', value: lifeExpense, from: resources, to: surplus, kind: 'neg' },
    { key: 'surplus', label: '扣除支出後的餘裕', sign: '＝', value: surplus, from: 0, to: surplus, kind: 'total' },
  ];
  return {
    assets, debts, expense, income, lifeMonths, resources, lifeExpense, surplus, steps,
    perMonth: resources / lifeMonths,                                  // 平均每月可用（餘命分攤）
    debtMonths: base.monthly > 0 ? debts / base.monthly : null,        // 借款約等於幾個月收入
    expenseRatio: base.monthly > 0 ? expense / base.monthly : null,    // 每月支出占月收入
    enough: surplus >= 0,
    // 每月可花到餘命結束的上限（還不扣借款以外的任何東西）：資源 ÷ 剩餘月數
    maxMonthlyExpense: resources / lifeMonths,
  };
}

/**
 * 五個等級（依「還清借款後的總資源 ÷ 餘命內固定支出」）。門檻是本站自訂的粗略分級，不是財務建議。
 * 缺口：100% 以下（含 100%）；吃緊：超過 100% 到 125% 以下；剛好：125% 到 150% 以下；餘裕：150% 到 200% 以下；完美：200% 以上（含 200%）。
 */
export const LEVELS = Object.freeze([
  { level: 1, name: '缺口', min: -Infinity, summary: '資源只夠或不夠支出（100% 以下），撐不到餘命結束。' },
  { level: 2, name: '吃緊', min: 1, summary: '資源略高於支出，但緩衝很薄。' },
  { level: 3, name: '剛好', min: 1.25, summary: '資源涵蓋支出，並有基本的緩衝。' },
  { level: 4, name: '餘裕', min: 1.5, summary: '資源明顯高於支出，緩衝不少。' },
  { level: 5, name: '完美', min: 2, summary: '資源達到支出的 2 倍以上，緩衝充足。' },
]);

const ADVICE = {
  1: ['先確認每月支出與借款是否都填對。', '可以從這幾件事試試看：提高月收入、延後退休年齡、降低每月支出、減少或提早還清高利率借款。', '上方可以調整數字，立刻看到等級變化。'],
  2: ['剛超過收支平衡，但任何意外支出、收入中斷或物價上漲都可能讓它回到缺口。', '可以先準備緊急預備金，並把高利率借款優先還清。'],
  3: ['有基本的緩衝。可以保留一部分當作緊急預備金，其餘再決定要用在退休準備、投資或提前還款。', '想更保守，可以把物價上漲與收入中斷的情況也試算看看。'],
  4: ['緩衝不少。可以考慮提高退休準備或投資的比例，也可以評估是否需要提高保障。', '再往上走就是「完美」：資源達到支出的 2 倍。'],
  5: ['資源明顯高於支出。可以考慮：提早退休、提高每月可花的金額，或把餘裕分配到投資、保障與提前還款。', '這個結果仍假設金額固定、不含通膨，實際規劃請留一些空間。'],
};

/**
 * 依計算結果評等。沒有填每月支出時無法比較，回 null。
 * ratio = 還清借款後的總資源 ÷ 餘命內固定支出（資源為負數視為缺口）。
 */
export function assessAssets(a) {
  if (!(a.lifeExpense > 0)) return null;
  const ratio = a.resources / a.lifeExpense;
  // 100% 以下（含）為缺口；其餘依門檻由高到低找（完美為 200% 以上，含 200%）
  const lv = ratio <= 1 ? LEVELS[0] : ([...LEVELS].reverse().find((x) => ratio >= x.min) ?? LEVELS[1]);
  const next = LEVELS.find((x) => x.level === lv.level + 1) ?? null;
  return {
    level: lv.level, name: lv.name, summary: lv.summary, ratio,
    advice: ADVICE[lv.level],
    // 還差多少資源才升到下一級（已是最高級回 null）
    toNext: next ? Math.max(Math.ceil(next.min * a.lifeExpense - a.resources) + (lv.level === 1 ? 1 : 0), 0) : null, // 缺口升級要「超過」100%
    nextName: next?.name ?? null,
    maxMonthlyExpense: a.maxMonthlyExpense,
  };
}

/** 資源增減圖每一步的說明（滑過或點選時顯示）。fmt 為金額格式函式。 */
export function stepHelp(a, monthly, fmt) {
  return {
    income: `人生最低收入：每月 ${fmt(monthly)} × 從現在到退休的月數，約 ${fmt(a.income)}。這是只靠目前月收入的保守估計，不含調薪與通膨。`,
    assets: `你填的存款、投資與其他資產，合計 ${fmt(a.assets)}；資產只計你填的項目（若勾選代入進階資料，投資以匯入的持股現值為準）。`,
    debts: `尚未償還的借款本金加預估利息，合計 ${fmt(a.debts)}，包含你新增的貸款與（若勾選）進階資料裡的借款。先把它們還清，剩下才是可用的資源。`,
    resources: `還清借款後的總資源 = 人生最低收入 + 資產 − 借款 = ${fmt(a.resources)}。平均分攤到剩下的 ${a.lifeMonths} 個月，每月約 ${fmt(a.perMonth)}。`,
    expense: `餘命內固定支出 = 每月 ${fmt(a.expense)} × 剩餘 ${a.lifeMonths} 個月 = ${fmt(a.lifeExpense)}。假設支出不變、不含通膨。`,
    surplus: a.surplus >= 0
      ? `扣除支出後還有約 ${fmt(a.surplus)} 的餘裕；每月最多可花約 ${fmt(a.maxMonthlyExpense)} 才不會出現缺口。`
      : `扣除支出後有約 ${fmt(-a.surplus)} 的缺口；每月最多可花約 ${fmt(Math.max(a.maxMonthlyExpense, 0))} 才不會出現缺口。`,
  };
}
