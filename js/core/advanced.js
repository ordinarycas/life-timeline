import { applyMarket, loadMarket } from './market.js';
// 進階：匯入的「生活支出月平均 + 借款利息」資料（純函式）。資料格式由 tools/xlsx_to_json.py 產生。
export const ADV_KEY = 'ltl.advanced.v1';
/** 借款類型（只用類型，不保存銀行名稱）。 */
export const LOAN_TYPES = Object.freeze({ credit: '銀行信用貸款', revolving: '銀行循環額度', policy: '保單借款' });
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 驗證並整理匯入的 JSON；有問題時丟出說明用的錯誤。只保留需要的欄位。 */
export function parseAdvanced(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('檔案不是有效的進階資料（需為物件）。');
  if (raw.version !== 1 && raw.version !== 2) throw new Error('不支援的版本（需為 version 1 或 2）。');
  const living = raw.livingMonthlyAvg;
  if (!Number.isFinite(living) || living < 0 || living > 10_000_000) throw new Error('生活支出月平均不正確。');
  if (!Array.isArray(raw.months) || !raw.months.length || raw.months.length > 600) throw new Error('借款月份資料不正確。');
  const seen = new Set();
  const months = raw.months.map((m) => {
    if (!m || !YM.test(m.ym) || seen.has(m.ym)) throw new Error(`借款月份不正確或重複：${m?.ym}`);
    seen.add(m.ym);
    for (const k of ['interest', 'principal']) if (!Number.isFinite(m[k]) || m[k] < 0 || m[k] > 1e9) throw new Error(`${m.ym} 的 ${k} 不正確。`);
    const parts = {};
    for (const t of Object.keys(LOAN_TYPES)) {
      const p = m.parts?.[t];
      if (p) {
        for (const k of ['interest', 'principal']) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1e9) throw new Error(`${m.ym} 的 ${t} ${k} 不正確。`);
        parts[t] = { interest: Math.round(p.interest), principal: Math.round(p.principal) };
      }
    }
    return { ym: m.ym, interest: Math.round(m.interest), principal: Math.round(m.principal), parts };
  }).sort((a, b) => (a.ym < b.ym ? -1 : 1));
  const money = (v, what) => { if (!Number.isFinite(v) || v < 0 || v > 1e10) throw new Error(`${what}不正確。`); return Math.round(v); };
  const rate = (v, what) => { if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error(`${what}不正確。`); return v; };
  const loans = (Array.isArray(raw.loans) ? raw.loans : []).map((l) => {
    if (!l || !LOAN_TYPES[l.type]) throw new Error(`借款類型不正確：${l?.type}`);
    const out = { type: l.type, balance: money(l.balance, '借款餘額'), rate: rate(l.rate, '借款年利率') };
    if (l.usd != null) { if (!Number.isFinite(l.usd) || l.usd < 0 || l.usd > 1e9) throw new Error('美元借款本金不正確。'); out.usd = l.usd; }
    return out;
  });
  if (raw.fx != null && (!Number.isFinite(raw.fx) || raw.fx < 5 || raw.fx > 100)) throw new Error('匯率不正確。');
  if (raw.holdings != null && (!Array.isArray(raw.holdings) || raw.holdings.length > 100)) throw new Error('持股資料不正確。');
  const holdings = (raw.holdings ?? []).map((x) => {
    if (!x || !/^[0-9A-Za-z]{4,8}$/.test(String(x.code)) || !['TWSE', 'TPEX'].includes(x.market) || !Number.isInteger(x.shares) || x.shares < 0 || x.shares > 1e9
      || !Number.isFinite(x.price) || x.price < 0 || x.price > 1e6 || typeof x.pledged !== 'boolean') throw new Error(`持股資料不正確：${x?.code}`);
    return { code: String(x.code), market: x.market, shares: x.shares, price: x.price, pledged: x.pledged };
  });
  const pl = raw.pledge;
  const pledge = pl ? { borrowed: money(pl.borrowed, '股票質押已借金額'), rate: rate(pl.rate, '股票質押年利率'), monthlyInterest: money(pl.monthlyInterest, '股票質押每月利息'), stockValue: money(pl.stockValue, '質押標的現值') } : null;
  return {
    version: 2, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt.slice(0, 10) : '', livingMonthlyAvg: Math.round(living), months,
    fx: raw.fx ?? null, holdings, loans, pledge, stockValueFree: raw.stockValueFree == null ? 0 : money(raw.stockValueFree, '未質押持股現值'),
  };
}

/** 讀取匯入的資料（原樣）。 */
export function loadAdvancedRaw(storage = globalThis.localStorage) {
  try { const s = storage.getItem(ADV_KEY); return s ? parseAdvanced(JSON.parse(s)) : null; } catch { return null; }
}
/** 讀取匯入的資料，並套用「線上更新」存下的股價與匯率（若有）。 */
export function loadAdvanced(storage = globalThis.localStorage) {
  const adv = loadAdvancedRaw(storage);
  return adv ? applyMarket(adv, loadMarket(storage)) : null;
}
export function saveAdvanced(adv, storage = globalThis.localStorage) { storage.setItem(ADV_KEY, JSON.stringify(adv)); }
export function clearAdvanced(storage = globalThis.localStorage) {
  try { storage.removeItem(ADV_KEY); } catch { /* 無法使用 localStorage */ }
}

const ymIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/**
 * 從今天（所在月份）起，經過 m 個月後累積的「生活支出 + 借款利息」。
 * 第 k 個月（k = 0…m-1）扣生活支出月平均，加上該月的借款利息（沒有資料的月份視為 0），
 * 以及股票質押的每月利息（假設本金不還、持續展延）。
 */
export function advancedSpent(adv, todayYm, m, { withPrincipal = false } = {}) {
  if (m <= 0) return 0;
  const t0 = ymIndex(todayYm);
  let interest = 0;
  for (const x of adv.months) { const k = ymIndex(x.ym) - t0; if (k >= 0 && k < m) interest += x.interest + (withPrincipal ? x.principal : 0); }
  return (adv.livingMonthlyAvg + (adv.pledge?.monthlyInterest ?? 0)) * m + interest;
}

/** 曲線上某年齡的累積值：累積收入 − 進階支出；今天之前為 0。cumIncome 為該年齡的累積收入。 */
export function advancedNet(adv, todayYm, today, x, cumIncome, opts) {
  if (x <= today) return 0;
  return cumIncome - advancedSpent(adv, todayYm, Math.round((x - today) * 12), opts);
}

/**
 * 代入資產與負債用（取代手填的借款、支出與投資）：
 * 借款本金 = 各貸款目前餘額（沒有餘額資料時用今天起的攤還本金）＋ 股票質押已借金額；
 * 利息 = 今天起各貸款的利息 ＋ 股票質押每月利息 × 剩餘月數（假設一直展延）；
 * 投資 = 質押標的現值 ＋ 未質押持股現值（有資料時才取代）。
 */
export function advancedAssetInputs(adv, todayYm, lifeMonths = 0) {
  const s = advancedSummary(adv, todayYm);
  const loanBal = adv.loans.reduce((t, l) => t + l.balance, 0);
  const out = {
    debt: (loanBal > 0 ? loanBal : s.principal) + (adv.pledge?.borrowed ?? 0),
    debtInterest: s.interest + (adv.pledge?.monthlyInterest ?? 0) * Math.max(lifeMonths, 0),
    expense: adv.livingMonthlyAvg,
  };
  const stocks = (adv.pledge?.stockValue ?? 0) + adv.stockValueFree;
  if (stocks > 0) out.assetInvest = stocks;
  return out;
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
  return { interest: sum('interest'), principal: sum('principal'), lastYm: future.at(-1)?.ym ?? null, byYear: [...byYear.values()], pledge: adv.pledge, loans: adv.loans };
}
