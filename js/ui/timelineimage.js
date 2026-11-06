// 把人生時間軸畫成一張圖片（Canvas 2D）：用來下載、分享、列印。永遠用淺色配色，內容包含已走過的階段。
import { KINDS } from '../data/tags.js';
import { ageText } from '../core/format.js';
import { BASELINE_AGE } from '../core/lifetime.js';
import { BANDS, bandText } from '../data/bands.js';
import { KIND_VAR } from './timeline.js';

const FONT = '"Noto Sans TC","Microsoft JhengHei","PingFang TC",system-ui,-apple-system,"Segoe UI",sans-serif';
const C = {
  page: '#ffffff', panel: '#e9f7f4', panel2: '#fff0e4', ink: '#2d3047', muted: '#565a74', grid: '#b9ddd8', focus: '#c2255c', coin: '#ffc857', past: '#626779',
  seg: { walked: '#d5dce8', work: '#99d8b9', retired: '#ffd9a8' },
};
const SEG_TEXT = { walked: '已走過', work: '工作期（至退休）', retired: '退休後' };
const W = 1000; const M = 20; const ROW_H = 28;

function kindColor(kind) {
  const v = globalThis.getComputedStyle?.(document.documentElement).getPropertyValue(KIND_VAR[kind])?.trim();
  return v || '#66cccc';
}

/**
 * @param {object} model buildTimeline 的結果
 * @param {{title:string, sub:string, scale?:number}} o
 * @returns {HTMLCanvasElement}
 */
export function drawTimelineImage(model, { title, sub, scale = 2 }) {
  const rows = model.rows;
  const hasMile = model.milestones?.length > 0;
  const kinds = [...new Set(rows.map((r) => r.tag.kind))];
  const probe = document.createElement('canvas').getContext('2d');
  const tw = (text, size, weight = 400) => { probe.font = `${weight} ${size}px ${FONT}`; return probe.measureText(text).width; };

  // 圖例換行
  const legend = [...kinds.map((k) => ({ k, text: KINDS[k], color: kindColor(k) })), { k: 'past', text: '已走過／已取得', color: C.past }, { k: 'now', text: '進行中／機會', color: '#ffffff', ring: true }, { k: 'fut', text: '尚未到', color: '#ffffff', dashed: true }];
  const lg = []; let lx = M; let ly = 74;
  for (const it of legend) {
    const w = 18 + tw(it.text, 12) + 14;
    if (lx + w > W - M) { lx = M; ly += 20; }
    lg.push({ ...it, x: lx, y: ly }); lx += w;
  }
  const top0 = ly + 22;
  const FLAG_Y = top0; const BAR_Y = top0 + 26; const RULER_Y = top0 + 56; const LANES_Y = top0 + 100;
  const lanes = (hasMile ? 1 : 0) + rows.length;
  const H = LANES_Y + lanes * ROW_H + 40;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.textBaseline = 'middle';
  const text = (s, x, y, size = 13, color = C.ink, align = 'left', weight = 400) => {
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y);
  };
  const ppy = (W - M * 2) / model.endAge;
  const x = (a) => M + a * ppy;

  g.fillStyle = C.page; g.fillRect(0, 0, W, H);
  text(title, M, 28, 24, C.ink, 'left', 700);
  text(sub, M, 54, 13, C.muted);
  for (const it of lg) {
    g.fillStyle = it.color; g.strokeStyle = C.ink; g.lineWidth = 2;
    g.setLineDash(it.dashed ? [3, 2] : []);
    g.fillRect(it.x, it.y - 6, 12, 12); g.strokeRect(it.x, it.y - 6, 12, 12); g.setLineDash([]);
    if (it.ring) { g.strokeStyle = C.focus; g.strokeRect(it.x - 2, it.y - 8, 16, 16); }
    text(it.text, it.x + 18, it.y, 12);
  }

  // 底板、刻度
  g.fillStyle = C.panel; g.fillRect(8, top0 - 8, W - 16, H - top0 - 24);
  g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(8, top0 - 8, W - 16, H - top0 - 24);
  for (let a = 0; a <= model.endAge; a += 10) {
    g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); g.moveTo(x(a) + 0.5, RULER_Y + 8); g.lineTo(x(a) + 0.5, LANES_Y + lanes * ROW_H); g.stroke();
    text(String(a), x(a), RULER_Y, 11, C.muted, 'center');
  }
  // 年齡階段
  for (const b of BANDS) {
    if (b.from >= model.endAge) continue;
    const bx = x(b.from); const bw = (Math.min(b.to, model.endAge) - b.from) * ppy;
    g.fillStyle = 'rgba(255,200,87,0.24)'; g.fillRect(bx, RULER_Y + 14, bw, LANES_Y + lanes * ROW_H - RULER_Y - 14);
    g.strokeStyle = C.muted; g.lineWidth = 1; g.setLineDash([3, 3]);
    for (const lx2 of [bx + 0.5, bx + bw - 0.5]) { g.beginPath(); g.moveTo(lx2, RULER_Y + 14); g.lineTo(lx2, LANES_Y + lanes * ROW_H); g.stroke(); }
    g.setLineDash([]);
    text(bandText(b, bw < 64), bx + bw / 2, RULER_Y + 27, 11, C.ink, 'center', 700);
  }
  // 主橫條
  for (const s of model.bars) {
    const sx = x(s.from); const sw = Math.max((s.to - s.from) * ppy, 4);
    g.fillStyle = C.seg[s.key]; g.fillRect(sx, BAR_Y, sw, 24);
    g.strokeStyle = C.ink; g.lineWidth = 2; g.strokeRect(sx, BAR_Y, sw, 24);
    g.save(); g.beginPath(); g.rect(sx + 2, BAR_Y, sw - 4, 24); g.clip();
    text(SEG_TEXT[s.key], sx + 6, BAR_Y + 12, 12); g.restore();
  }
  // 各排
  let i = 0;
  const rowTop = () => LANES_Y + i * ROW_H;
  const sep = (y) => { g.strokeStyle = C.grid; g.lineWidth = 1; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(10, y + ROW_H - 0.5); g.lineTo(W - 10, y + ROW_H - 0.5); g.stroke(); g.setLineDash([]); };
  const label = (s, lx0, y, color, rightEdge) => {
    const w = tw(s, 13) + 8;
    const left = rightEdge ? rightEdge - w : lx0;
    g.fillStyle = 'rgba(255,255,255,0.86)'; g.fillRect(left, y - 10, w, 20);
    text(s, left + 4, y, 13, color);
  };
  if (hasMile) {
    const y = rowTop();
    g.fillStyle = C.panel2; g.fillRect(9, y, W - 18, ROW_H - 1);
    text('基本收入累積', x(BASELINE_AGE) - 12, y + ROW_H / 2, 12, C.muted, 'right');
    model.milestones.forEach((ms, k) => {
      const cx = x(ms.age); const cy = y + ROW_H / 2; const reached = ms.age <= model.age;
      g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2);
      g.fillStyle = reached ? C.coin : C.page; g.fill();
      g.lineWidth = 2; g.strokeStyle = reached ? C.ink : C.muted; g.setLineDash(reached ? [] : [3, 2]); g.stroke(); g.setLineDash([]);
      const t = `${ms.amount / 10000} 萬`; const full = `${t}（${ageText(ms.age)} 歲）`;
      const next = model.milestones[k + 1];
      const room = next ? x(next.age) - cx - 26 : W - M - cx - 14;
      const s = tw(full, 13) + 8 <= room ? full : t;
      const w = tw(s, 13) + 8;
      if (cx + 14 + w > W - M) label(s, 0, cy, C.ink, cx - 14); else label(s, cx + 14, cy, C.ink);
    });
    sep(y); i++;
  }
  for (const r of rows) {
    const y = rowTop(); const cy = y + ROW_H / 2;
    const gray = r.state === 'past' || r.state === 'done';
    const color = gray ? C.past : kindColor(r.tag.kind);
    const fut = r.state === 'future' || r.state === 'chance';
    let leftX; let rightX;
    if (r.point) {
      const px = x(r.at); leftX = px - 11; rightX = px + 11;
      g.beginPath(); g.moveTo(px, cy - 9); g.lineTo(px + 9, cy); g.lineTo(px, cy + 9); g.lineTo(px - 9, cy); g.closePath();
      g.fillStyle = r.state === 'chance' ? C.coin : fut ? C.page : color; g.fill();
      g.lineWidth = 2; g.strokeStyle = r.state === 'now' ? C.focus : C.ink; g.stroke();
    } else {
      const reach = r.ext ? r.ext.to : r.to;
      const w = Math.max((reach - r.from) * ppy, 26); const bx = x(r.from); const by = cy - 10;
      const mainW = r.ext ? Math.max(((r.to - r.from) / (reach - r.from)) * w, 4) : w;
      if (r.state === 'now') { g.strokeStyle = C.focus; g.lineWidth = 2; g.strokeRect(bx - 4, by - 3, w + 8, 26); }
      if (r.state === 'chance') { g.strokeStyle = C.coin; g.lineWidth = 2; g.strokeRect(bx - 4, by - 3, w + 8, 26); }
      g.globalAlpha = fut ? 0.55 : 1; g.fillStyle = color; g.fillRect(bx, by, mainW, 20); g.globalAlpha = 1;
      if (r.ext) { g.globalAlpha = 0.3; g.fillStyle = color; g.fillRect(bx + mainW, by, w - mainW, 20); g.globalAlpha = 1; }
      g.strokeStyle = C.ink; g.lineWidth = 2; g.setLineDash(fut ? [4, 3] : []); g.strokeRect(bx, by, w, 20); g.setLineDash([]);
      leftX = bx; rightX = bx + w;
    }
    const lw = tw(r.label, 13) + 8;
    const color2 = gray ? C.muted : C.ink;
    if (rightX + 6 + lw > W - M && leftX - 6 - lw > 0) label(r.label, 0, cy, color2, leftX - 6); else label(r.label, rightX + 6, cy, color2);
    sep(y); i++;
  }
  // 現在線與旗標
  const nx = x(model.age); const bottom = LANES_Y + lanes * ROW_H;
  g.strokeStyle = C.focus; g.lineWidth = 3; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(nx, BAR_Y - 4); g.lineTo(nx, bottom); g.stroke(); g.setLineDash([]);
  const flag = (s, fx, right, color) => {
    const w = tw(s, 12) + 12; const left = right ? fx - w : fx;
    g.fillStyle = C.page; g.fillRect(left, FLAG_Y, w, 20); g.strokeStyle = color; g.lineWidth = 2; g.strokeRect(left, FLAG_Y, w, 20);
    text(s, left + 6, FLAG_Y + 10, 12);
  };
  const nowText = `現在 ${ageText(model.age)} 歲`;
  flag(nowText, nx, nx + tw(nowText, 12) + 12 > W - M, C.focus);
  const ex = x(model.endAge);
  if (Math.abs(ex - nx) > 190) flag(`平均預期壽命 ${ageText(model.endAge)} 歲`, ex, true, C.ink);

  text('LifeTimeline｜規劃參考，不是法律、財務或投資建議，也不預測壽命；實際規定請以主管機關公告為準。', M, H - 14, 11, C.muted);
  return canvas;
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
