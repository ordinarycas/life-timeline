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
