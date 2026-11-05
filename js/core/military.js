// 兵役模型（男性，純函式）。依據《兵役法》第 3、6、9、10、15、16、17、25、34、35 條（規格 §5.3）。
// 這是依法規框架與出生年次所做的預估，不是徵集通知；不判斷體位、免役、緩徵或替代役資格。
import { ageOn } from './lifetime.js';

export const SERVICE_TYPES = ['regular', 'officer', 'nco', 'supp', 'alt'];
export const SERVICE_TYPE_LABEL = Object.freeze({
  regular: '常備兵役（依出生年次）',
  officer: '預備軍官役',
  nco: '預備士官役',
  supp: '補充兵役',
  alt: '替代役',
});
export const SERVICE_AGE_MIN = 18;
export const SERVICE_AGE_MAX = 36;

/** 役齡期間（《兵役法》第 3 條）：年滿 18 歲之翌年 1/1（出生年＋19）起，至屆滿 36 歲之年 12/31（出生年＋36）止。 */
export function eligibleWindow(birthIso) {
  const birthYear = Number(birthIso.slice(0, 4));
  const startDate = `${birthYear + 19}-01-01`;
  const endDate = `${birthYear + 36}-12-31`;
  return { birthYear, startDate, endDate, startAge: ageOn(birthIso, startDate), endAge: ageOn(birthIso, endDate) };
}

/**
 * 服役長度（月，法定「以內」的上限）。regular／alt 依出生年次（2005 年起 12 個月；1994–2004 年 4 個月；更早無法估計）；
 * officer／nco／supp 不依年次。無法估計時回傳 null。
 * @returns {{months:number, name:string, detail:string}|null}
 */
export function serviceLength(birthYear, type) {
  const byCohort = birthYear >= 2005 ? 12 : birthYear >= 1994 ? 4 : null;
  switch (type) {
    case 'regular':
      if (byCohort == null) return null;
      return byCohort === 12
        ? { months: 12, name: '現役', detail: '常備兵役現役，為期一年' }
        : { months: 4, name: '軍事訓練', detail: '常備兵役軍事訓練，四個月以內' };
    case 'alt':
      return byCohort == null ? null : { months: byCohort, name: '替代役', detail: '替代役期間連同基礎訓練不少於同年次的常備兵役役期' };
    case 'officer': return { months: 18, name: '預備軍官役', detail: '基礎教育一年以內＋見習六個月以內' };
    case 'nco': return { months: 12, name: '預備士官役', detail: '基礎教育八個月以內＋見習四個月以內' };
    case 'supp': return { months: 2, name: '補充兵役', detail: '二個月以內軍事訓練' };
    default: return null;
  }
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * 兵役相關車道的位置（以年齡計）。
 * service：auto（依出生年次預估）／done（已服完或已免役，只畫完成標籤）／hide（全部不畫）。
 * @returns {{hidden:boolean, mode:string, window:object, length:object|null, active:{from:number,to:number,months:number}|null,
 *            reserve:{from:number,to:number}|null, doneAt:number|null, noEstimate:boolean}}
 */
export function servicePlan({ birth, service = 'auto', serviceAge = 22, serviceType = 'regular' }) {
  const window = eligibleWindow(birth);
  const base = { hidden: false, mode: service, window, length: null, active: null, reserve: null, doneAt: null, noEstimate: false };
  if (service === 'hide') return { ...base, hidden: true };
  const at = clamp(Number(serviceAge) || 22, window.startAge, window.endAge);
  if (service === 'done') return { ...base, doneAt: at };
  const length = serviceLength(window.birthYear, serviceType);
  if (!length) return { ...base, noEstimate: true };
  const from = at;
  const to = Math.min(from + length.months / 12, window.endAge);
  return {
    ...base, length,
    active: { from, to, months: length.months },
    reserve: to < window.endAge ? { from: to, to: window.endAge } : null,
  };
}
