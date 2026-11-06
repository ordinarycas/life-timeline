// 進階資料的 JSON 範例：數字都是虛構的，從「下個月」起排 36 個月，匯入後馬上能看到效果。純函式。
import { loanCost } from './loans.js';

const addMonths = (ym, n) => {
  const i = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};

/**
 * @param {string} todayYm 'YYYY-MM'
 * @param {string} today 'YYYY-MM-DD'
 */
export function buildExample(todayYm, today) {
  const credit = { balance: 600_000, rate: 0.035, months: 36 };
  const pmt = loanCost({ principal: credit.balance, months: credit.months, rate: credit.rate * 100 }).monthly;
  const revolving = { balance: 100_000, rate: 0.08 };
  const policy = { balance: 200_000, rate: 0.05 };
  const months = [];
  let bal = credit.balance;
  for (let k = 1; k <= credit.months; k++) {
    const interest = Math.round((bal * credit.rate) / 12);
    const principal = k === credit.months ? bal : pmt - interest;
    bal -= principal;
    const parts = {
      credit: { interest, principal },
      revolving: { interest: Math.round((revolving.balance * revolving.rate) / 12), principal: 0 },
      policy: { interest: Math.round((policy.balance * policy.rate) / 12), principal: 0 },
    };
    months.push({
      ym: addMonths(todayYm, k),
      interest: parts.credit.interest + parts.revolving.interest + parts.policy.interest,
      principal: parts.credit.principal,
      parts,
    });
  }
  const pledgeBorrowed = 500_000; const pledgeRate = 0.025;
  return {
    version: 2,
    exportedAt: today,
    livingMonthlyAvg: 38_000,
    months,
    loans: [
      { type: 'credit', balance: credit.balance, rate: credit.rate },
      { type: 'revolving', balance: revolving.balance, rate: revolving.rate },
      { type: 'policy', balance: policy.balance, rate: policy.rate },
    ],
    pledge: { borrowed: pledgeBorrowed, rate: pledgeRate, monthlyInterest: Math.round((pledgeBorrowed * pledgeRate) / 12), stockValue: 1_000_000 },
    fx: 32,
    holdings: [
      { code: '0050', market: 'TWSE', shares: 5000, price: 150, pledged: true },
      { code: '2330', market: 'TWSE', shares: 1000, price: 250, pledged: true },
    ],
    stockValueFree: 300_000,
  };
}
