// 時間軸圖片的附加內容：「累積收入曲線」與「資產與負債」。各畫成一張同寬的 canvas，再接在時間軸圖片下面。永遠用淺色配色。
import { money } from '../core/format.js';
import { assessAssets, LEVELS } from '../core/assets.js';
import { renderCurveImage } from './incomecurve.js';
import { FONT } from './timelineimage.js';
import { SITE_NAME, SITE_INTRO } from '../data/site.js';

const W = 1000; const M = 20;
const C = { page: '#ffffff', ink: '#2d3047', muted: '#565a74', grid: '#b9ddd8', line: '#2d3047', coin: '#ffc857', ok: '#1c7c4f', gap: '#b03a3a', panel: '#e9f7f4' };
const BAR = { total: '#6c7a9c', pos: '#7bc68f', neg: '#e58a8a', low: '#cc6666' };
const total = (v) => (v < 0 ? `－${money(-v)}` : money(v));

function context(w = 10, h = 10) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.getContext('2d'); }
function wrap(g, text, maxW, size) {
  g.font = `400 ${size}px ${FONT}`;
  const lines = []; let cur = '';
  for (const ch of text) { if (g.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch; }
  if (cur) lines.push(cur);
  return lines;
}

/** 累積收入曲線：用 Chart.js 在畫面外畫一張淺色的圖（不受目前分頁是否顯示影響）。p 是 renderCurve 用的參數。 */
export async function drawCurveSection(p, scale = 2) {
  const probe = context();
  const caption = '月收入固定、不含調薪與通膨；實線是從現在開始的累積收入，其他線見圖上的說明。是估算，不是保證。';
  const capLines = wrap(probe, caption, W - M * 2, 12);
  const chartH = 420;
  const H = 44 + chartH + capLines.length * 18 + 16;
  const chart = await renderCurveImage(p, W - M * 2, chartH);
  const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext('2d'); g.scale(scale, scale); g.textBaseline = 'middle';
  g.fillStyle = C.page; g.fillRect(0, 0, W, H);
  g.font = `700 18px ${FONT}`; g.fillStyle = C.ink; g.textAlign = 'left'; g.fillText('累積收入曲線', M, 24);
  g.drawImage(chart, M, 44, W - M * 2, chartH);
  g.font = `400 12px ${FONT}`; g.fillStyle = C.muted;
  capLines.forEach((t, i) => g.fillText(t, M, 44 + chartH + 14 + i * 18));
  return c;
}

/** 資產與負債：結論、五級、資源增減圖、備註。 */
export function drawAssetsSection({ a, monthly, fromAdv = false, loans = null }, scale = 2) {
  const probe = context();
  const inner = W - M * 2;
  const verdict = a.enough
    ? `把資產、借款和固定支出都算進去，餘命內約還有 ${money(a.surplus)} 的餘裕（假設支出不變）。`
    : `把資產、借款和固定支出都算進去，餘命內約有 ${money(-a.surplus)} 的缺口（假設支出不變）。`;
  const as = assessAssets(a);
  const levelText = as ? `第 ${as.level} 級：${as.name}｜${as.summary}（總資源是餘命內支出的 ${(as.ratio * 100).toFixed(0)}%）` : '尚未填每月固定生活支出，所以沒有評等。';
  const notes = [`算法：人生最低收入（${money(monthly)} × 到退休的月數）＋ 資產 － 借款本金與預估利息 － 每月固定支出 × 剩餘月數。金額固定、以今天的新台幣計，不含通膨、投資報酬、退休金與自住不動產的居住價值。這是粗略的對照，不是理財或投資建議。`];
  if (loans) notes.push(`其中新增的貸款（含房貸）本金 ${money(loans.principal)}、預估利息 ${money(loans.interest)}。`);
  if (fromAdv) notes.push('借款、利息、每月支出與投資現值來自「進階」匯入的資料。');
  const vLines = wrap(probe, verdict, inner, 14);
  const lLines = wrap(probe, levelText, inner, 13);
  const nLines = notes.flatMap((t) => wrap(probe, t, inner, 11));
  const ROW = 28;
  const H = 44 + vLines.length * 22 + 8 + lLines.length * 20 + (as ? 40 : 0) + 8 + a.steps.length * ROW + 12 + nLines.length * 16 + 14;

  const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext('2d'); g.scale(scale, scale); g.textBaseline = 'middle';
  const text = (s, x, y, size = 13, color = C.ink, align = 'left', weight = 400) => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };
  g.fillStyle = C.page; g.fillRect(0, 0, W, H);
  text('代入資產與負債：還有餘裕嗎？', M, 24, 18, C.ink, 'left', 700);
  let y = 44;
  vLines.forEach((t, i) => text(t, M, y + 11 + i * 22, 14, a.enough ? C.ok : C.gap, 'left', 700));
  y += vLines.length * 22 + 8;
  lLines.forEach((t, i) => text(t, M, y + 10 + i * 20, 13));
  y += lLines.length * 20;
  if (as) {
    const segW = (inner - 4 * 6) / 5;
    LEVELS.forEach((l, i) => {
      const sx = M + i * (segW + 6); const on = l.level === as.level;
      g.fillStyle = on ? C.coin : l.level < as.level ? '#f3e6c0' : '#f2f2f2'; g.fillRect(sx, y + 6, segW, 26);
      g.strokeStyle = on ? C.ink : C.grid; g.lineWidth = on ? 2 : 1; g.strokeRect(sx, y + 6, segW, 26);
      text(`${l.level} ${l.name}`, sx + segW / 2, y + 19, 13, C.ink, 'center', on ? 700 : 400);
    });
    y += 40;
  }
  y += 8;
  // 資源增減圖
  const vals = a.steps.flatMap((s) => [s.from, s.to, 0]);
  const lo = Math.min(...vals); const hi = Math.max(...vals); const span = Math.max(hi - lo, 1);
  const tx = 320; const tw = 420;
  const px = (v) => tx + ((v - lo) / span) * tw;
  for (const s of a.steps) {
    const cy = y + ROW / 2;
    text(`${s.sign ? `${s.sign} ` : ''}${s.label}`, M, cy, 12);
    g.fillStyle = C.panel; g.fillRect(tx, cy - 9, tw, 18);
    const a0 = Math.min(s.from, s.to); const b0 = Math.max(s.from, s.to);
    g.fillStyle = s.kind === 'total' ? (s.to < 0 ? BAR.low : BAR.total) : BAR[s.kind];
    g.fillRect(px(a0), cy - 9, Math.max(px(b0) - px(a0), 3), 18);
    g.strokeStyle = C.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(px(0) + 0.5, cy - 11); g.lineTo(px(0) + 0.5, cy + 11); g.stroke();
    text(s.kind === 'total' ? total(s.value) : `${s.sign}${money(Math.abs(s.value))}`, tx + tw + 12, cy, 12, C.ink, 'left', s.kind === 'total' ? 700 : 400);
    y += ROW;
  }
  y += 12;
  nLines.forEach((t, i) => text(t, M, y + 8 + i * 16, 11, C.muted));
  return c;
}

/** 圖片最下方：網站名稱、簡介與網址（url 為空就不寫網址那一行）。目的是讓看到分享圖片的人也能自己使用。 */
export function drawPromoSection({ url = '' } = {}, scale = 2) {
  const probe = context();
  const lines = wrap(probe, SITE_INTRO, W - M * 2 - 24, 13);
  const H = 24 + 34 + lines.length * 21 + (url ? 44 : 14) + 16;
  const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext('2d'); g.scale(scale, scale); g.textBaseline = 'middle';
  const text = (s, x, y, size, color, weight = 400) => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'left'; g.fillText(s, x, y); };
  g.fillStyle = C.page; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff6ea'; g.fillRect(M, 12, W - M * 2, H - 24);
  g.fillStyle = C.coin; g.fillRect(M, 12, 8, H - 24);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(M, 12, W - M * 2, H - 24);
  text(SITE_NAME, M + 24, 12 + 24, 20, C.ink, 700);
  lines.forEach((t, i) => text(t, M + 24, 12 + 52 + i * 21, 13, C.ink));
  if (url) text(`立即使用：${url}`, M + 24, 12 + 52 + lines.length * 21 + 22, 17, '#1f5f5f', 700);
  return c;
}

/** 把附加的 canvas 由上而下接在時間軸圖片下面，中間用細線隔開。 */
export function composeSections(base, sections) {
  const out = document.createElement('canvas');
  out.width = base.width;
  out.height = base.height + sections.reduce((t, s) => t + s.height, 0);
  const g = out.getContext('2d');
  g.fillStyle = C.page; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(base, 0, 0);
  let y = base.height;
  for (const s of sections) {
    g.drawImage(s, 0, y);
    g.strokeStyle = C.grid; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + 1); g.lineTo(out.width, y + 1); g.stroke();
    y += s.height;
  }
  return out;
}
