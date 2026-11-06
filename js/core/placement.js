// 時間軸模型（純函式）：把偏好設定與標籤資料集換算成「每個標籤一排」的位置、狀態與排序。規格 §4.1、§4.5、§5.2。
import { ageOn, remainingLife, KID_YEARS } from './lifetime.js';
import { servicePlan } from './military.js';
import { yearsAgo } from './clock.js';
import { DEFAULTS } from '../data/prefs.js';
import { TAGS, KIND_ORDER } from '../data/tags.js';
import { BASELINE_WAGE } from '../data/wage.js';
import { BASELINE_AGE } from './lifetime.js';
import { loanCost } from './loans.js';
import { BANDS } from '../data/bands.js';
import { ORGANS, accelFrom, accelText } from '../data/health.js';
import { money } from './format.js';

/** 沒填性別或生日時顯示的示範資料：男、30 歲。示範資料不寫入偏好設定。 */
export const DEMO = Object.freeze({ sex: 'male', yearsOld: 30 });
export const demoBirth = (todayIso) => yearsAgo(todayIso, DEMO.yearsOld);

const MIN_SPAN = 0.05; // 小於這個長度（年）的區間視為沒有區間

/** 個人時間軸需要性別與有效生日（生日不得晚於今天）。 */
export const isPersonal = (prefs, todayIso) => (prefs.sex === 'male' || prefs.sex === 'female') && ageOn(prefs.birth, todayIso) != null;

/**
 * @param {object} prefs 已驗證的偏好設定
 * @param {string} todayIso 台北今天
 * @param {readonly object[]} [tags]
 */
export function buildTimeline(prefs, todayIso, tags = TAGS) {
  const personal = isPersonal(prefs, todayIso);
  const eff = personal ? prefs : {
    ...DEFAULTS, sex: DEMO.sex, birth: demoBirth(todayIso),
  };
  const sex = eff.sex;
  const birth = eff.birth;
  const age = ageOn(birth, todayIso);
  const lifeLeft = remainingLife(sex, age);
  const endAge = age + lifeLeft;
  const retire = eff.retire;
  const stop = Math.min(retire, endAge);
  const military = sex === 'male'
    ? servicePlan({ birth, service: eff.service, serviceAge: eff.serviceAge, serviceType: eff.serviceType })
    : null;
  const ctx = { sex, birth, birthYear: Number(birth.slice(0, 4)), age, lifeLeft, endAge, retire, prefs: eff, military, kidYears: KID_YEARS };

  const rows = [];
  for (const tag of tags) {
    if (tag.draw === false) continue;
    if (tag.audience !== 'all' && tag.audience !== sex) continue;
    if (tag.requires && !tag.requires(ctx)) continue;
    const pos = tag.place ? tag.place(ctx) : (tag.at != null ? { at: tag.at } : { from: tag.from, to: tag.to });
    if (!pos) continue;
    const row = normalize(tag, pos, age, endAge, (eff.have ?? []).includes(tag.id));
    if (row) rows.push(row);
  }
  // 使用者自訂的房貸：畫成一條「財務」橫條（不是標籤資料，沒有官方來源）
  const mg = eff.mortgage;
  if (mg) {
    const start = mg.start > 0 ? mg.start : age;
    const c = loanCost({ principal: mg.amount, months: mg.years * 12, rate: mg.rate });
    const tag = { id: 'mortgage', label: '房貸', kind: 'money', audience: 'all', user: true, short: '', detail: [], sources: [] };
    const row = normalize(tag, {
      from: start, to: start + mg.years, label: `房貸（${mg.years} 年）`,
      short: `貸款 ${money(mg.amount)}、年利率 ${mg.rate}%，本息平均攤還每月約 ${money(c.monthly)}，${Math.round((start + mg.years) * 10) / 10} 歲還清。這是你在進階設定填的資料，不是法規。`,
    }, age, endAge);
    if (row) rows.push(row);
  }
  // 職涯／人生探索：24–36 歲，每四年一個階段（24–28、29–32、33–36）。本站規劃用的分段，不是標籤資料
  {
    const tag = { id: 'career-explore', label: '職涯／人生探索', kind: 'explore', audience: 'all', user: true, short: '', detail: [], sources: [] };
    const row = normalize(tag, {
      from: 24, to: 36,
      short: `24 歲起每四年一個階段：${BANDS.map((b) => `${b.name}（${b.label} 歲）`).join('、')}。這段時間自由度最大。放大時間軸到 400% 會分成三個階段。這是本站規劃用的分段，不是法規。`,
    }, age, endAge);
    if (row) rows.push(row);
  }
  // 健康參考（選用）：相同「開始變化」年齡的器官併在同一排。每排一個「開始」點（◆）；
  // 每個不同的「加速變化」年齡再一個點（●）。非官方資料，不是標籤。
  if (eff.health) {
    const list = ORGANS.filter((o) => o.audience === 'all' || o.audience === sex);
    const byOnset = new Map();
    for (const o of list) byOnset.set(o.onset, [...(byOnset.get(o.onset) ?? []), o]);
    const names = (os) => os.map((o) => o.label).join('／');
    const NOTE = '民間媒體整理、非官方，不是醫療建議。';
    for (const [onset, orgs] of [...byOnset].sort((x, y) => x[0] - y[0])) {
      const lane = `health-${onset}`;
      const add = (suffix, variant, label, at, short, extra) => {
        const tag = { id: `${lane}-${suffix}`, label, kind: 'health', variant, lane, audience: 'all', user: true, short: '', detail: [], sources: [] };
        const row = normalize(tag, { at, label, short, extra }, age, endAge);
        if (row) rows.push(row);
      };
      add('start', 'start', names(orgs), onset, `平均約 ${onset} 歲開始變化：${names(orgs)}。${NOTE}`, null);
      const byAccel = new Map();
      for (const o of orgs) byAccel.set(accelFrom(o), [...(byAccel.get(accelFrom(o)) ?? []), o]);
      for (const [a0, os] of [...byAccel].sort((x, y) => x[0] - y[0])) {
        const withRange = os.map((o) => (Array.isArray(o.accel) ? `${o.label}（${accelText(o)}）` : o.label)).join('／');
        const common = os.filter((o) => o.common).map((o) => `${o.label}：${o.common}`).join('；');
        add(`accel-${a0}`, 'accel', `加速：${withRange}`, a0,
          `${os.map((o) => `${o.label}約 ${accelText(o)}`).join('、')}開始加速變化。${NOTE}`, common ? `圖表標示加速變化後較常見：${common}。` : null);
      }
    }
  }
  rows.sort((a, b) => a.start - b.start || KIND_ORDER.indexOf(a.tag.kind) - KIND_ORDER.indexOf(b.tag.kind) || (a.tag.id < b.tag.id ? -1 : 1));

  // 已走過或已取得的收進「已走過」；還有機會的（含尚未取得的）留在主畫面
  const past = rows.filter((r) => r.state === 'past' || r.state === 'done');
  const live = rows.filter((r) => r.state !== 'past' && r.state !== 'done');
  return {
    demo: !personal, lv: personal ? Math.floor(age * 100) / 100 : DEMO.yearsOld, sex, birth, age, lifeLeft, endAge, retire, stop, military, ctx,
    // 主橫條三段：已走過／退休前工作期／退休後（長度為 0 的段落省略）
    bars: segments(age, endAge, retire),
    rows, past, live,
    milestones: milestones(stop, endAge),
    pastTo: past.reduce((m, r) => Math.max(m, r.end), 0),
  };
}

function segments(age, endAge, retire) {
  const out = [{ key: 'walked', from: 0, to: age }];
  const stop = Math.min(retire, endAge);
  if (age < stop) out.push({ key: 'work', from: age, to: stop });
  const afterFrom = Math.max(stop, age);
  if (endAge > afterFrom) out.push({ key: 'retired', from: afterFrom, to: endAge });
  return out.filter((s) => s.to - s.from >= MIN_SPAN);
}

/**
 * 狀態：past 已走過、now 進行中、future 尚未到、done 使用者標記已取得、chance 年齡已過但尚未取得（仍是機會）。
 * 可標記取得的標籤（obtainable）與只有年齡下限的標籤（openEnded，如各種考試）過了年齡仍算機會。
 */
function stateFor(tag, base, owned) {
  if (owned && tag.obtainable) return 'done';
  if (base === 'past' && (tag.obtainable || tag.openEnded)) return 'chance';
  return base;
}

function normalize(tag, pos, age, endAge, owned = false) {
  const label = pos.label ?? tag.label;
  const short = pos.short ?? tag.short;
  if (pos.at != null) {
    if (pos.at >= endAge) return null;
    return {
      tag, id: tag.id, label, short, extra: pos.extra ?? null, point: true,
      at: pos.at, start: pos.at, end: pos.at, state: stateFor(tag, pos.at <= age ? 'past' : 'future', owned), ext: null, owned,
    };
  }
  const from = Math.max(pos.from, 0);
  if (from >= endAge) return null;
  const to = Math.min(pos.to, endAge);
  if (to - from < MIN_SPAN) return null;
  const ext = pos.ext && pos.ext.from < endAge ? { from: pos.ext.from, to: Math.min(pos.ext.to, endAge) } : null;
  const reach = ext ? ext.to : to; // 有延伸段時，延伸段結束前都不算「已走過」
  const state = stateFor(tag, reach <= age ? 'past' : from <= age ? 'now' : 'future', owned);
  return { tag, id: tag.id, label, short, extra: pos.extra ?? null, point: false, from, to, start: from, end: reach, state, ext, owned };
}

/** 從 18 歲起只領基本工資，累積到 100 萬、500 萬、1000 萬、1500 萬的年齡（到不了的省略）。 */
export const MILESTONES = Object.freeze([1_000_000, 5_000_000, 10_000_000, 15_000_000]);
export function milestones(stopAge, endAge, wage = BASELINE_WAGE) {
  if (!(wage > 0)) return [];
  return MILESTONES.map((amount) => ({ amount, age: BASELINE_AGE + amount / (wage * 12) })).filter((m) => m.age <= Math.min(stopAge, endAge));
}

/** 同一排（tag.lane 相同）的列併成一個項目；其他列各自一個項目。順序以第一次出現為準。 */
export function laneItems(rows) {
  const out = []; const idx = new Map();
  for (const r of rows) {
    const k = r.tag.lane;
    if (!k) { out.push({ rows: [r] }); continue; }
    if (!idx.has(k)) { const it = { lane: k, rows: [] }; idx.set(k, it); out.push(it); }
    idx.get(k).rows.push(r);
  }
  return out;
}

/**
 * 同一排有多個點時，標籤放在點的右邊：空間不夠就截短（加「…」），連 3 個字都放不下，或會壓到前一個標籤，就不畫標籤
 * （點本身與點開來的說明仍在）。
 * @param {{leftX:number,rightX:number,text:string}[]} pts 由左到右
 * @param {number} limit 右邊界
 * @param {(text:string, room:number)=>string|null} fit 在 room 像素內放得下就回傳（可能截短後的）文字，放不下回傳 null
 * @returns {(string|null)[]}
 */
export function lanePlan(pts, limit, fit) {
  let lastEnd = -Infinity;
  return pts.map((p, k) => {
    const left = Math.max(p.rightX + 6, lastEnd + 4);
    const next = pts[k + 1];
    const room = (next ? next.leftX - 4 : limit) - left;
    const text = room > 0 ? fit(p.text, room) : null;
    if (text) { lastEnd = left + room; return text; }
    lastEnd = Math.max(lastEnd, p.rightX);
    return null;
  });
}

/** 以 13px 字、左右各留一點空白估算寬度（時間軸用）。 */
export function fitByChars(text, room) {
  const chars = [...text];
  const n = Math.floor((room - 14) / 13);
  if (n >= chars.length) return text;
  return n >= 3 ? `${chars.slice(0, n - 1).join('')}…` : null;
}
