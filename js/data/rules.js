// 標籤的「規則」：依生日、性別、設定計算位置與文字的函式。內容（名稱、說明、來源）在 tags.json，用標籤 id 對應。
import { ageText, yearAt } from '../core/format.js';
import { kidOverlap } from '../core/lifetime.js';

export const RULES = Object.freeze({
  'working-holiday': { place: () => ({ from: 18, to: 30, ext: { from: 30, to: 35 } }) },
  'service-age': {
    place: (c) => {
      const p = c.military;
      if (!p || p.hidden) return null;
      return { from: p.window.startAge, to: p.window.endAge, extra: `你的役齡期間：${p.window.startDate} 至 ${p.window.endDate}` };
    },
  },
  'service-active': {
    place: (c) => {
      const p = c.military;
      if (!p || p.hidden) return null;
      if (p.mode === 'done') {
        return { at: Math.min(p.doneAt, c.age), label: '兵役（已完成）', short: '你標示已服完兵役或已免役，這裡只畫完成標記。' };
      }
      if (!p.active) return null;
      const { from, to, months } = p.active;
      return {
        from, to,
        label: `兵役：${p.length.name}`,
        short: `約 ${ageText(from)} 歲入營，最長約 ${months} 個月，約 ${ageText(to)} 歲結束。`,
        extra: `${p.length.detail}；預計入營 ${yearAt(c.birth, from)} 年前後`,
      };
    },
  },
  'service-reserve': {
    place: (c) => {
      const p = c.military;
      if (!p || p.hidden || !p.reserve) return null;
      return { from: p.reserve.from, to: p.reserve.to };
    },
  },
  kids: {
    requires: (c) => c.prefs.kid === true && Number.isFinite(c.prefs.kidAge),
    place: (c) => {
      const k = c.prefs.kidAge;
      const overlap = kidOverlap({ kidAge: k, retire: c.retire, age: c.age, kidYears: c.kidYears });
      return { from: k, to: k + c.kidYears, extra: `育兒區間與你的工作期重疊約 ${ageText(overlap)} 年` };
    },
  },
});
