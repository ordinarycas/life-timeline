// 「時間與收入」的純函式（無 DOM，可在 Node 測試）。
import { LIFE_TABLE } from '../data/life-table.js';
import { isValidIso, DAY_MS } from './clock.js';

export { LIFE_TABLE };

/** 育兒年數：《民法》第 12 條「滿十八歲為成年」；本站簡化假設，不含大學以後的支援（規格 §5.1）。 */
export const KID_YEARS = 18;
/** 「從 18 歲起領基本工資」對照線的起點。 */
export const BASELINE_AGE = 18;

/** 某性別、某年齡（可為小數）的平均餘命（年）。非 female 一律用男性表。 */
export function remainingLife(sex, age) {
  const t = sex === 'female' ? LIFE_TABLE.female : LIFE_TABLE.male;
  const a = Math.max(Number(age) || 0, 0);
  if (a >= 100) return 0.5;
  const i = Math.min(Math.floor(a / 10), t.length - 2);
  const [a0, e0] = t[i];
  const [a1, e1] = t[i + 1];
  return e0 + ((e1 - e0) * (a - a0)) / (a1 - a0);
}

/** 以出生日（YYYY-MM-DD）與今天算年齡（含小數，1 年 ＝ 365.2425 天）。格式不符、不存在的日期或生日晚於今天回傳 null。 */
export function ageOn(birthIso, todayIso) {
  if (!isValidIso(birthIso) || !isValidIso(todayIso)) return null;
  const days = (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${birthIso}T00:00:00Z`)) / DAY_MS;
  return days < 0 ? null : days / 365.2425;
}

/**
 * 人生最低收入試算（以今天的新台幣計，不含調薪、通膨與折現）。
 * @param {{sex:'male'|'female', age:number, retireAge:number, monthly:number}} p
 */
export function lifetimeIncome({ sex, age, retireAge, monthly }) {
  const lifeLeft = remainingLife(sex, age);
  const endAge = age + lifeLeft;
  const stopAge = Math.min(retireAge, endAge); // 規格 §5.1：stopAge = min(退休年齡, 預期壽命)；已退休時小於現在年齡
  const workYears = Math.max(Math.min(retireAge, endAge) - age, 0);
  const workMonths = Math.round(workYears * 12);
  const income = monthly * workMonths;
  const lifeMonths = Math.max(Math.round(lifeLeft * 12), 1);
  return {
    lifeLeft, endAge, stopAge, workYears, workMonths, income, lifeMonths,
    perLifeMonth: income / lifeMonths, // 把這輩子賺的錢平均分到每個月能用多少
    retired: age >= retireAge,
    retirementYears: Math.max(endAge - Math.max(retireAge, age), 0),
  };
}

/** 晚開始：從 start 歲才開始領同樣的月薪。start 不大於目前年齡時回傳 null。 */
export function lateStart({ age, stopAge, monthly, start, income }) {
  if (!(start > age)) return null;
  const lateYears = Math.max(stopAge - start, 0);
  const lateIncome = monthly * Math.round(lateYears * 12);
  return { start, lateYears, lateIncome, lost: income - lateIncome, delayYears: start - age };
}

/** 對照：從 baseAge 歲起就領固定月薪（預設現行基本工資），到 stopAge 的累積。stopAge 不大於 baseAge 時回傳 null。 */
export function baseline({ stopAge, wage, income, baseAge = BASELINE_AGE }) {
  if (!(stopAge > baseAge)) return null;
  const years = stopAge - baseAge;
  const baseIncome = wage * Math.round(years * 12);
  return { baseAge, years, baseIncome, diff: baseIncome - income };
}

/** 育兒區間與工作期重疊的年數：max(min(k+育兒年數, 退休) − max(k, 現在), 0)。 */
export function kidOverlap({ kidAge, retire, age, kidYears = KID_YEARS }) {
  return Math.max(Math.min(kidAge + kidYears, retire) - Math.max(kidAge, age), 0);
}

/** 在 x 歲時的累積收入：startAge 開始領、stopAge 停止（之後持平）。 */
export function cumulativeIncome({ monthly, startAge, stopAge }, x) {
  const worked = Math.min(Math.max(x, startAge), stopAge) - startAge;
  return monthly * Math.round(Math.max(worked, 0) * 12);
}

/** 曲線資料點：每整數歲一點，外加起點、開始領與停止領的歲數（皆限制在 xFrom～xTo 內）。 */
export function incomeSeries(params, xFrom, xTo) {
  const xs = new Set();
  for (let x = Math.ceil(xFrom); x <= xTo; x++) xs.add(x);
  for (const x of [xFrom, params.startAge, params.stopAge, xTo]) if (x >= xFrom && x <= xTo) xs.add(Math.round(x * 1e6) / 1e6);
  return [...xs].sort((a, b) => a - b).map((x) => ({ x, y: cumulativeIncome(params, x) }));
}
