// 使用者自行新增的貸款（本息平均攤還）：借款本金、期數（月）、年利率（%）。純函式。
export const MAX_LOANS = 10;

/** 驗證一筆貸款；回傳 { ok, value } 或 { ok:false, error }。 */
export function validateLoan(l) {
  const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,\s]/g, '')));
  const principal = num(l?.principal); const months = num(l?.months); const rate = num(l?.rate);
  if (!Number.isFinite(principal) || principal <= 0 || principal > 1e9) return { ok: false, error: '借款本金請輸入大於 0 的金額' };
  if (!Number.isInteger(months) || months < 1 || months > 600) return { ok: false, error: '期數請輸入 1 到 600 的整數（月）' };
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, error: '年利率請輸入 0 到 100（%）' };
  return { ok: true, value: { principal: Math.round(principal), months, rate } };
}

/** 本息平均攤還：每月還款 = 本金 × r ÷ (1 − (1 + r)^−n)，r 為月利率；利率 0 則本金平分。 */
export function loanCost({ principal, months, rate }) {
  const r = rate / 100 / 12;
  const monthly = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
  const total = monthly * months;
  return { monthly: Math.round(monthly), total: Math.round(total), interest: Math.round(total - principal) };
}

/** 一組貸款的合計：本金、利息、每月還款。 */
export function loansTotal(loans) {
  return loans.reduce((t, l) => {
    const c = loanCost(l);
    return { principal: t.principal + l.principal, interest: t.interest + c.interest, monthly: t.monthly + c.monthly };
  }, { principal: 0, interest: 0, monthly: 0 });
}
