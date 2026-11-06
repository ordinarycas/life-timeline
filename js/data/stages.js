// 時間軸放大到 400% 時，學制橫條切成每年一格的標籤。labels 的數量要等於標籤的年數；
// span 是每格幾年（預設 1）；reserve 是「預留」的格子（依學校規定可能多讀），畫成斜線。年限依據見 tags.json 各標籤的說明與來源。
import { BANDS, bandText } from './bands.js';

export const STAGE_YEARS = Object.freeze({
  elementary: { labels: ['一年級', '二年級', '三年級', '四年級', '五年級', '六年級'], reserve: [] },
  junior: { labels: ['七年級', '八年級', '九年級'], reserve: [] },
  senior: { labels: ['高一', '高二', '高三'], reserve: [] },
  'five-year': { labels: ['專一', '專二', '專三', '專四', '專五'], reserve: [] },
  university: { labels: ['大一', '大二', '大三', '大四'], reserve: ['大五', '大六'] },
  'two-year': { labels: ['大一', '大二'], reserve: [] },
  master: { labels: ['碩一', '碩二'], reserve: ['碩三'] },
  phd: { labels: ['博一', '博二', '博三', '博四'], reserve: ['博五'] },
  // 職涯／人生探索：24 歲起每四年一個階段（本站規劃用的分段，不是法規）。每格 4 年。
  'career-explore': { labels: BANDS.map((b) => bandText(b)), reserve: [], span: 4 },
});

/** 這一排能不能分格：有定義，而且年數對得上。 */
export function yearCells(row) {
  const def = STAGE_YEARS[row.id];
  if (!def || row.point || Math.abs((row.to - row.from) - def.labels.length * (def.span ?? 1)) > 0.01) return null;
  return def;
}
