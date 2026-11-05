// 標籤資料集（規格 §3、§4.5）：內容在 tags.json，位置規則在 rules.js，載入後合併成 TAGS。
// 硬性規則：每個標籤至少一個 primary 來源（發布機關、文件名稱、https 連結、查閱日期）；沒有官方來源的內容不得放入。
// 使用前必須先呼叫 initTags()（瀏覽器由 app.js 透過 loader.js 載入；測試與工具由 tests/helpers/load.js）。
import { RULES } from './rules.js';

export let SOURCES = Object.freeze({});
/** 類型顯示名稱與排序（同年齡時依此排序）。 */
export let KINDS = Object.freeze({});
export let KIND_ORDER = [];
export let TAGS = Object.freeze([]);

export function initTags(data) {
  SOURCES = Object.freeze(Object.fromEntries(Object.entries(data.sources).map(([k, v]) => [k, Object.freeze(v)])));
  KINDS = Object.freeze({ ...data.kinds });
  KIND_ORDER = Object.keys(KINDS);
  TAGS = Object.freeze(data.tags.map((t) => {
    const sources = t.sources.map((k) => {
      if (!SOURCES[k]) throw new Error(`標籤 ${t.id} 引用了不存在的來源 ${k}`);
      return SOURCES[k];
    });
    return Object.freeze({ ...t, sources: Object.freeze(sources), ...(RULES[t.id] ?? {}) });
  }));
}

export const tagById = (id) => TAGS.find((t) => t.id === id) ?? null;

/** 顯示用：標籤是否適用目前性別（未填性別時全部顯示）。 */
export const appliesTo = (tag, sex) => tag.audience === 'all' || !sex || tag.audience === sex;
