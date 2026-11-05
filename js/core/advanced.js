// 進階：匯入的「生活支出月平均 + 借款利息」資料（純函式）。資料格式由 tools/xlsx_to_json.py 產生。
export const ADV_KEY = 'ltl.advanced.v1';
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 驗證並整理匯入的 JSON；有問題時丟出說明用的錯誤。只保留需要的欄位。 */
export function parseAdvanced(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('檔案不是有效的進階資料（需為物件）。');
  if (raw.version !== 1) throw new Error('不支援的版本（需為 version 1）。');
  const living = raw.livingMonthlyAvg;
  if (!Number.isFinite(living) || living < 0 || living > 10_000_000) throw new Error('生活支出月平均不正確。');
  if (!Array.isArray(raw.months) || !raw.months.length || raw.months.length > 600) throw new Error('借款月份資料不正確。');
  const seen = new Set();
  const months = raw.months.map((m) => {
    if (!m || !YM.test(m.ym) || seen.has(m.ym)) throw new Error(`借款月份不正確或重複：${m?.ym}`);
    seen.add(m.ym);
    for (const k of ['interest', 'principal']) if (!Number.isFinite(m[k]) || m[k] < 0 || m[k] > 1e9) throw new Error(`${m.ym} 的 ${k} 不正確。`);
    return { ym: m.ym, interest: Math.round(m.interest), principal: Math.round(m.principal) };
  }).sort((a, b) => (a.ym < b.ym ? -1 : 1));
  return { version: 1, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt.slice(0, 10) : '', livingMonthlyAvg: Math.round(living), months };
}

export function loadAdvanced(storage = globalThis.localStorage) {
  try { const s = storage.getItem(ADV_KEY); return s ? parseAdvanced(JSON.parse(s)) : null; } catch { return null; }
}
export function saveAdvanced(adv, storage = globalThis.localStorage) { storage.setItem(ADV_KEY, JSON.stringify(adv)); }
export function clearAdvanced(storage = globalThis.localStorage) {
  try { storage.removeItem(ADV_KEY); } catch { /* 無法使用 localStorage */ }
}

const ymIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/**
 * 從今天（所在月份）起，經過 m 個月後累積的「生活支出 + 借款利息」。
 * 第 k 個月（k = 0…m-1）扣生活支出月平均，加上該月的借款利息（沒有資料的月份視為 0）。
 */
export function advancedSpent(adv, todayYm, m, { withPrincipal = false } = {}) {
  if (m <= 0) return 0;
  const t0 = ymIndex(todayYm);
  let interest = 0;
  for (const x of adv.months) { const k = ymIndex(x.ym) - t0; if (k >= 0 && k < m) interest += x.interest + (withPrincipal ? x.principal : 0); }
  return adv.livingMonthlyAvg * m + interest;
}

/** 曲線上某年齡的累積值：累積收入 − 進階支出；今天之前為 0。cumIncome 為該年齡的累積收入。 */
export function advancedNet(adv, todayYm, today, x, cumIncome, opts) {
  if (x <= today) return 0;
  return cumIncome - advancedSpent(adv, todayYm, Math.round((x - today) * 12), opts);
}

/** 代入資產與負債用：今天起的借款本金、利息，以及生活支出月平均（覆蓋手填的借款與支出）。 */
export function advancedAssetInputs(adv, todayYm) {
  const s = advancedSummary(adv, todayYm);
  return { debt: s.principal, debtInterest: s.interest, expense: adv.livingMonthlyAvg };
}

/** 摘要：今天起的借款利息、本金總額、最後一期月份，以及依年度彙總。 */
export function advancedSummary(adv, todayYm) {
  const t0 = ymIndex(todayYm);
  const future = adv.months.filter((x) => ymIndex(x.ym) >= t0);
  const sum = (k) => future.reduce((s, x) => s + x[k], 0);
  const byYear = new Map();
  for (const x of future) {
    const y = x.ym.slice(0, 4);
    const e = byYear.get(y) ?? { year: y, interest: 0, principal: 0 };
    e.interest += x.interest; e.principal += x.principal; byYear.set(y, e);
  }
  return { interest: sum('interest'), principal: sum('principal'), lastYm: future.at(-1)?.ym ?? null, byYear: [...byYear.values()] };
}
