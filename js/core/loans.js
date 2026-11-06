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

/** 已還 paid 期之後的剩餘本金與剩餘利息（本息平均攤還）。 */
export function loanRemaining({ principal, months, rate }, paid) {
  const r = rate / 100 / 12;
  const k = Math.min(Math.max(Math.floor(paid), 0), months);
  const pmt = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
  const balance = r === 0 ? principal - pmt * k : principal * (1 + r) ** k - (pmt * ((1 + r) ** k - 1)) / r;
  const bal = Math.max(Math.round(balance), 0);
  return { balance: bal, interest: Math.max(Math.round(pmt * (months - k) - bal), 0), monthly: Math.round(pmt), remainingMonths: months - k };
}

/** 房貸：貸款金額、年利率（%）、年限（年）、幾歲開始還款（0＝現在）。 */
export function validateMortgage(m) {
  const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[,\s]/g, '')));
  const amount = num(m?.amount); const rate = num(m?.rate); const years = num(m?.years); const start = m?.start == null || m.start === '' ? 0 : num(m.start);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10) return { ok: false, error: '房貸金額請輸入大於 0 的金額' };
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, error: '房貸年利率請輸入 0 到 100（%）' };
  if (!Number.isInteger(years) || years < 1 || years > 50) return { ok: false, error: '房貸年限請輸入 1 到 50 的整數（年）' };
  if (!Number.isInteger(start) || (start !== 0 && (start < 15 || start > 90))) return { ok: false, error: '開始還款年齡請輸入 15 到 90 的整數，或留空（從現在開始）' };
  return { ok: true, value: { amount: Math.round(amount), rate, years, start } };
}
