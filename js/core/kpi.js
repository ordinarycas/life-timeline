// 結果指標（純函式）：由時間軸模型與偏好設定算出 KPI 與曲線參數。公式見規格 §5.1。
import { lifetimeIncome, lateStart, baseline, kidOverlap, BASELINE_AGE } from './lifetime.js';
import { monthlyFromPrefs, BASELINE_WAGE } from '../data/wage.js';

/**
 * @param {object} model buildTimeline 的結果
 * @param {object} prefs 偏好設定（示範資料時 model.demo 為 true，月薪仍以偏好設定為準）
 */
export function computeKpi(model, prefs) {
  const monthly = monthlyFromPrefs(prefs);
  const inc = lifetimeIncome({ sex: model.sex, age: model.age, retireAge: model.retire, monthly });
  const startAge = prefs.start > 0 ? Math.max(prefs.start, model.age) : model.age;
  const late = prefs.start > 0
    ? lateStart({ age: model.age, stopAge: inc.stopAge, monthly, start: prefs.start, income: inc.income })
    : null;
  const base = baseline({ stopAge: inc.stopAge, wage: BASELINE_WAGE, income: inc.income, baseAge: BASELINE_AGE });
  const kid = prefs.kid ? kidOverlap({ kidAge: prefs.kidAge, retire: model.retire, age: model.age }) : null;
  return {
    monthly, inc, late, base, kid,
    startAge,
    mineIncome: late ? late.lateIncome : inc.income,
    // 曲線：x 軸從 18 歲（或目前年齡，取較小者）到壽命終點；對照線從 18 歲起領基本工資
    curve: {
      expense: Number(prefs.expense) > 0 ? Number(prefs.expense) : 0,
      monthly, startAge: late ? late.start : model.age, stopAge: Math.max(inc.stopAge, model.age),
      xFrom: Math.min(model.age, BASELINE_AGE), xTo: model.endAge, today: model.age,
      base: base ? { monthly: BASELINE_WAGE, startAge: BASELINE_AGE, stopAge: inc.stopAge } : null,
    },
  };
}
