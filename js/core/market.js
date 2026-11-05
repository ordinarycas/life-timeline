// 線上更新的市場資料（純函式 + 儲存）：USD/TWD 匯率、臺灣證券交易所（上市）收盤價。
// 只在進階頁按下「更新」時才連線；存下的結果在首頁讀取時套用到匯入的進階資料。
export const MARKET_KEY = 'ltl.market.v1';

export function loadMarket(storage = globalThis.localStorage) {
  try {
    const m = JSON.parse(storage.getItem(MARKET_KEY) || 'null');
    if (!m || typeof m !== 'object') return null;
    const fx = m.fx && Number.isFinite(m.fx.rate) && m.fx.rate > 5 && m.fx.rate < 100 ? { rate: m.fx.rate, at: String(m.fx.at ?? '') } : null;
    const prices = {};
    for (const [k, v] of Object.entries(m.prices ?? {})) {
      if (/^[0-9A-Za-z]{4,8}$/.test(k) && Number.isFinite(v?.price) && v.price > 0 && v.price < 1e6) prices[k] = { price: v.price, date: String(v.date ?? '') };
    }
    return { fx, prices, updatedAt: String(m.updatedAt ?? '') };
  } catch { return null; }
}
export function saveMarket(m, storage = globalThis.localStorage) { storage.setItem(MARKET_KEY, JSON.stringify(m)); }
export function clearMarket(storage = globalThis.localStorage) {
  try { storage.removeItem(MARKET_KEY); } catch { /* 無法使用 localStorage */ }
}

/** 解析 TWSE「個股日成交資訊」JSON，取最後一個交易日的收盤價；失敗回 null。 */
export function parseTwseDay(j) {
  if (!j || j.stat !== 'OK' || !Array.isArray(j.fields) || !Array.isArray(j.data) || !j.data.length) return null;
  const i = j.fields.indexOf('收盤價');
  if (i < 0) return null;
  for (let k = j.data.length - 1; k >= 0; k--) {
    const row = j.data[k];
    const price = Number(String(row[i]).replace(/,/g, ''));
    if (Number.isFinite(price) && price > 0 && price < 1e6) return { price, date: String(row[0]) }; // 日期為民國 115/11/05
  }
  return null;
}

/** 解析 open.er-api.com 的 USD 匯率回應，取 TWD；失敗回 null。 */
export function parseFx(j) {
  const rate = j?.result === 'success' ? Number(j.rates?.TWD) : NaN;
  if (!Number.isFinite(rate) || rate < 10 || rate > 60) return null;
  return { rate, at: String(j.time_last_update_utc ?? '') };
}

/**
 * 把線上更新的股價與匯率套用到進階資料（回傳新物件，不改原本）：
 * - 持股：有新價的用新價重算「質押標的現值」「未質押持股現值」；沒有的沿用匯入價。
 * - 美元借款（保單借款）：本金＝美元本金 × 新匯率；該類型的每月利息與本金依匯率比例調整。
 */
export function applyMarket(adv, market) {
  if (!market || (!market.fx && !Object.keys(market.prices).length)) return adv;
  const out = { ...adv };
  if (adv.holdings.length && Object.keys(market.prices).length) {
    const hs = adv.holdings.map((x) => ({ ...x, price: market.prices[x.code]?.price ?? x.price }));
    const val = (p) => Math.round(hs.filter((x) => x.pledged === p).reduce((t, x) => t + x.shares * x.price, 0));
    out.holdings = hs;
    out.stockValueFree = val(false);
    if (adv.pledge) out.pledge = { ...adv.pledge, stockValue: val(true) };
  }
  if (market.fx && adv.fx) {
    const ratio = market.fx.rate / adv.fx;
    const usdTypes = new Set(adv.loans.filter((l) => l.usd != null).map((l) => l.type));
    out.loans = adv.loans.map((l) => (l.usd != null ? { ...l, balance: Math.round(l.usd * market.fx.rate) } : l));
    out.months = adv.months.map((m) => {
      let dInt = 0; let dPrin = 0; const parts = { ...m.parts };
      for (const t of usdTypes) {
        const p = m.parts[t];
        if (!p) continue;
        const ni = Math.round(p.interest * ratio); const np = Math.round(p.principal * ratio);
        dInt += ni - p.interest; dPrin += np - p.principal;
        parts[t] = { interest: ni, principal: np };
      }
      return { ...m, parts, interest: m.interest + dInt, principal: m.principal + dPrin };
    });
  }
  return out;
}
