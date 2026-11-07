// 偏好設定：驗證、夾限、存取（localStorage `ltl.prefs.v1`）。性別與生日只存在這個瀏覽器，不會傳到任何地方。
import { isValidIso } from '../core/clock.js';
import { MAX_LOANS, validateLoan, validateMortgage } from '../core/loans.js';
import { parseYoutubeId, watchUrl } from '../core/youtube.js';
import { SERVICE_TYPES, SERVICE_AGE_MIN, SERVICE_AGE_MAX } from '../core/military.js';

/** 使用者可以標記「已取得」的學歷與證照（沒標記就是還有機會）。 */
export const HAVE_IDS = Object.freeze(['license-basic', 'license-heavy', 'license-pro', 'university', 'master', 'phd']);

export const PREFS_KEY = 'ltl.prefs.v1';
export const HINTS_KEY = 'ltl.hints.v1';

export const DEFAULTS = Object.freeze({
  sex: '', birth: '', have: [], retire: 65, start: 0, kid: false, kidAge: 30, useAdv: false, loans: [], mortgage: null, health: false,
  wage: 'current', monthly: 0, service: 'auto', serviceAge: 22, serviceType: 'regular', music: 'off', musicUrl: '', theme: 'light', skin: 'pixel',
  assetCash: 0, assetInvest: 0, assetOther: 0, debt: 0, debtInterest: 0, expense: 0,
});

export const MSG = Object.freeze({
  birthFuture: '生日不能晚於今天',
  birthInvalid: '請輸入有效的生日（西元 1900 年之後）',
  retire: '退休年齡請輸入 40 到 80',
  start: '請輸入 10 到 80 的整數，或留空代表從現在開始',
  kidAge: '請輸入 15 到 60 的整數',
  monthly: '請輸入 0 或以上的金額',
  amount: '請輸入 0 或以上的金額',
  amountBig: '金額過大，請輸入 100 億以下',
  monthlyBig: '金額過大，請輸入 1,000 萬以下',
  serviceAge: `請輸入 ${SERVICE_AGE_MIN} 到 ${SERVICE_AGE_MAX} 的整數`,
});

const ok = (value) => ({ ok: true, value });
const bad = (error) => ({ ok: false, error });
const INT = /^\s*-?\d+\s*$/;
const toInt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : NaN) : typeof v === 'string' && INT.test(v) ? Number(v) : NaN);
const inRange = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

/**
 * 驗證並正規化單一欄位。
 * @returns {{ok:true,value:any}|{ok:false,error:string}}
 */
export function validateField(key, raw, { todayIso, musicIds = [] } = {}) {
  switch (key) {
    case 'sex': return ['', 'male', 'female'].includes(raw) ? ok(raw) : bad('請選擇性別');
    case 'birth':
      if (raw === '' || raw == null) return ok('');
      if (!isValidIso(raw) || raw < '1900-01-01') return bad(MSG.birthInvalid);
      if (todayIso && raw > todayIso) return bad(MSG.birthFuture);
      return ok(raw);
    case 'retire': { const n = toInt(raw); return inRange(n, 40, 80) ? ok(n) : bad(MSG.retire); }
    case 'start': {
      if (raw === '' || raw == null) return ok(0);
      const n = toInt(raw);
      return n === 0 || inRange(n, 10, 80) ? ok(n) : bad(MSG.start);
    }
    case 'mortgage': {
      if (raw == null) return ok(null);
      const v = validateMortgage(raw);
      return v.ok ? ok(v.value) : bad(v.error);
    }
    case 'loans': {
      if (!Array.isArray(raw) || raw.length > MAX_LOANS) return bad('貸款資料不正確');
      const list = [];
      for (const l of raw) { const v = validateLoan(l); if (!v.ok) return bad(v.error); list.push(v.value); }
      return ok(list);
    }
    case 'health': return typeof raw === 'boolean' ? ok(raw) : bad('請選擇是否顯示健康參考');
    case 'useAdv': return typeof raw === 'boolean' ? ok(raw) : bad('請選擇是否代入進階資料');
    case 'kid': return typeof raw === 'boolean' ? ok(raw) : bad('請選擇是否有小孩');
    case 'kidAge': { const n = toInt(raw); return inRange(n, 15, 60) ? ok(n) : bad(MSG.kidAge); }
    case 'wage': return ['current', 'proposed', 'custom'].includes(raw) ? ok(raw) : bad('請選擇月薪來源');
    case 'monthly': {
      if (raw === '' || raw == null) return ok(0);
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s]/g, ''));
      if (!Number.isFinite(n) || n < 0) return bad(MSG.monthly);
      if (n > 10_000_000) return bad(MSG.monthlyBig);
      return ok(Math.round(n));
    }
    case 'assetCash': case 'assetInvest': case 'assetOther': case 'debt': case 'debtInterest': case 'expense': {
      if (raw === '' || raw == null) return ok(0);
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s]/g, ''));
      if (!Number.isFinite(n) || n < 0) return bad(MSG.amount);
      if (n > 10_000_000_000) return bad(MSG.amountBig);
      return ok(Math.round(n));
    }
    case 'have': return Array.isArray(raw) && raw.every((x) => HAVE_IDS.includes(x)) ? ok([...new Set(raw)]) : bad('已取得的項目不正確');
    case 'service': return ['auto', 'done', 'hide'].includes(raw) ? ok(raw) : bad('請選擇兵役顯示方式');
    case 'serviceAge': { const n = toInt(raw); return inRange(n, SERVICE_AGE_MIN, SERVICE_AGE_MAX) ? ok(n) : bad(MSG.serviceAge); }
    case 'serviceType': return SERVICE_TYPES.includes(raw) ? ok(raw) : bad('請選擇役別');
    case 'music': return raw === 'off' || raw === 'custom' || musicIds.includes(raw) ? ok(raw) : bad('找不到這首歌');
    case 'musicUrl': { if (raw === '' || raw == null) return ok(''); const id = parseYoutubeId(raw); return id ? ok(watchUrl(id)) : bad('這不是有效的 YouTube 網址'); }
    case 'theme': return ['light', 'dark', 'auto'].includes(raw) ? ok(raw) : bad('請選擇主題');
    case 'skin': return ['pixel', 'poster'].includes(raw) ? ok(raw) : bad('請選擇風格');
    default: return bad('未知的欄位');
  }
}

/** 把任意物件整理成合法的偏好設定：沒有的鍵用預設值、不合法的值回預設。 */
export function sanitize(raw, ctx = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src)) continue;
    const r = validateField(key, src[key], ctx);
    out[key] = r.ok ? r.value : DEFAULTS[key];
  }
  return out;
}

const store = (s) => { try { return s ?? globalThis.localStorage ?? null; } catch { return null; } };

export function loadPrefs(storage, ctx) {
  try {
    const raw = store(storage)?.getItem(PREFS_KEY);
    return sanitize(raw ? JSON.parse(raw) : null, ctx);
  } catch { return sanitize(null, ctx); }
}

/** 寫入失敗（私密模式、容量滿）回傳 false，不丟例外。 */
export function savePrefs(storage, prefs) {
  try { store(storage)?.setItem(PREFS_KEY, JSON.stringify(prefs)); return true; } catch { return false; }
}

/** 「清除本機資料」：偏好設定與提示狀態全部移除。 */
export function clearAll(storage) {
  try { const s = store(storage); s?.removeItem(PREFS_KEY); s?.removeItem(HINTS_KEY); return true; } catch { return false; }
}

export function loadHints(storage) {
  try { const v = JSON.parse(store(storage)?.getItem(HINTS_KEY) ?? 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function saveHints(storage, hints) {
  try { store(storage)?.setItem(HINTS_KEY, JSON.stringify(hints)); return true; } catch { return false; }
}
