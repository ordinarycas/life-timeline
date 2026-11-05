// 時間軸模型（純函式）：把偏好設定與標籤資料集換算成「每個標籤一排」的位置、狀態與排序。規格 §4.1、§4.5、§5.2。
import { ageOn, remainingLife, KID_YEARS } from './lifetime.js';
import { servicePlan } from './military.js';
import { yearsAgo } from './clock.js';
import { DEFAULTS } from '../data/prefs.js';
import { TAGS, KIND_ORDER } from '../data/tags.js';

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
  rows.sort((a, b) => a.start - b.start || KIND_ORDER.indexOf(a.tag.kind) - KIND_ORDER.indexOf(b.tag.kind) || (a.tag.id < b.tag.id ? -1 : 1));

  // 已走過或已取得的收進「已走過」；還有機會的（含尚未取得的）留在主畫面
  const past = rows.filter((r) => r.state === 'past' || r.state === 'done');
  const live = rows.filter((r) => r.state !== 'past' && r.state !== 'done');
  return {
    demo: !personal, lv: personal ? Math.floor(age * 100) / 100 : DEMO.yearsOld, sex, birth, age, lifeLeft, endAge, retire, stop, military, ctx,
    // 主橫條三段：已走過／退休前工作期／退休後（長度為 0 的段落省略）
    bars: segments(age, endAge, retire),
    rows, past, live,
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
