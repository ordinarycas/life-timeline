// 累積收入曲線（Chart.js，自家託管於 vendor/）。顏色取自 CSS 變數，主題改變時重畫；列印時改淺色並固定尺寸。
import { incomeSeries, cumulativeIncome, netSeries, netCumulative } from '../core/lifetime.js';
import { advancedNet } from '../core/advanced.js';
import { money, ageText } from '../core/format.js';
import { reducedMotion } from './dom.js';

let chart = null;
let loading = null;
let printing = false;

function loadChart() {
  if (globalThis.Chart) return Promise.resolve(globalThis.Chart);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/chart.umd.min.js';
    s.onload = () => resolve(globalThis.Chart);
    s.onerror = () => { loading = null; reject(new Error('chart load failed')); };
    document.head.append(s);
  });
  return loading;
}

// 各曲線的角色：顏色欄位（palette 的鍵）與期末金額標籤的垂直位移
const ROLE = { main: ['line', 16], base: ['base', -8], net: ['net', 30], adv: ['adv', 44], pay: ['pay', 58] };

const PRINT_PAL = { ink: '#000000', muted: '#333333', grid: '#bdbdbd', line: '#1a3f8a', base: '#1c7c4f', net: '#8a1f2d', adv: '#4b2a85', pay: '#8a4300', coin: '#5a3a00', surface: '#ffffff' };

function applyPalette(c, pal) {
  const o = c.options;
  c.data.datasets[0].borderColor = pal.line;
  for (const ds of c.data.datasets) ds.borderColor = pal[ROLE[ds.ltlRole]?.[0] ?? 'line'];
  c.options.plugins.legend.labels.color = pal.ink;
  for (const k of ['x', 'y']) { o.scales[k].title.color = pal.ink; o.scales[k].ticks.color = pal.muted; o.scales[k].grid.color = pal.grid; }
  o.plugins.ltlMarkers.pal = pal;
}

function palette() {
  if (printing) return PRINT_PAL;
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return { ink: v('--ink'), muted: v('--muted'), grid: v('--grid'), line: v('--curve-main'), base: v('--curve-base'), net: v('--curve-net'), adv: v('--curve-adv'), pay: v('--curve-pay'), coin: v('--coin'), surface: v('--surface') };
}

// 垂直虛線（今天、退休）與各曲線在退休點的金額
const markers = {
  id: 'ltlMarkers',
  afterDatasetsDraw(c, _a, opts) {
    const { ctx, chartArea: ca, scales: { x, y } } = c;
    if (!opts?.pal) return;
    ctx.save();
    ctx.fillStyle = opts.pal.ink; ctx.strokeStyle = opts.pal.muted; ctx.font = '12px sans-serif';
    const vline = (age, text, side) => {
      const px = x.getPixelForValue(age);
      if (px < ca.left || px > ca.right) return;
      ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(px, ca.top); ctx.lineTo(px, ca.bottom); ctx.stroke(); ctx.setLineDash([]);
      const w = ctx.measureText(text).width;
      ctx.fillText(text, side < 0 ? Math.max(px - w - 4, ca.left) : Math.min(px + 4, ca.right - w), ca.top + 12);
    };
    if (opts.today != null && opts.today > x.min) vline(opts.today, '今天', 1);
    if (opts.stop != null) vline(opts.stop, `退休 ${ageText(opts.stop)} 歲`, 1);
    c.data.datasets.forEach((ds, i) => {
      const pt = ds.data.find((d) => Math.abs(d.x - opts.stop) < 1e-6) ?? ds.data.at(-1);
      if (!pt) return;
      const text = money(pt.y);
      const w = ctx.measureText(text).width;
      const px = Math.min(x.getPixelForValue(pt.x) - w - 4, ca.right - w);
      const [ck, dy] = ROLE[ds.ltlRole] ?? ROLE.main;
      ctx.fillStyle = ck === 'line' ? opts.pal.ink : opts.pal[ck];
      ctx.fillText(text, px, y.getPixelForValue(pt.y) + dy);
    });
    ctx.restore();
  },
};

/** @param {{monthly:number,startAge:number,stopAge:number,xFrom:number,xTo:number}} p */
export async function renderCurve(canvas, p) {
  const Chart = await loadChart();
  const pal = palette();
  const data = incomeSeries({ monthly: p.monthly, startAge: p.startAge, stopAge: p.stopAge }, p.xFrom, p.xTo);
  const datasets = [{ label: `從現在開始（月收入 ${money(p.monthly)}）`, data, borderColor: pal.line, backgroundColor: pal.line, borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, fill: false }];
  if (p.base) {
    datasets.push({ label: `對照：18 歲起領基本工資 ${money(p.base.monthly)}（點線）`, data: incomeSeries(p.base, p.xFrom, p.xTo), borderColor: pal.base, backgroundColor: pal.base, borderWidth: 3, borderDash: [2, 5], pointRadius: 0, pointHoverRadius: 4, fill: false });
  }
  if (p.expense > 0) {
    const sp = { monthly: p.monthly, startAge: p.startAge, stopAge: p.stopAge };
    datasets.push({ label: `扣除每月消費 ${money(p.expense)} 後（虛線）`, ltlRole: 'net', data: netSeries(sp, p.expense, p.today, p.xFrom, p.xTo), borderColor: pal.net, backgroundColor: pal.net, borderWidth: 3, borderDash: [8, 4], pointRadius: 0, pointHoverRadius: 4, fill: false });
  }
  if (p.adv) {
    const sp = { monthly: p.monthly, startAge: p.startAge, stopAge: p.stopAge };
    const data = incomeSeries(sp, p.xFrom, p.xTo).map((d) => ({ x: d.x, y: advancedNet(p.adv.data, p.adv.todayYm, p.today, d.x, d.y) }));
    datasets.push({ label: `扣除生活支出月平均 ${money(p.adv.data.livingMonthlyAvg)} 與借款${p.adv.data.pledge ? '、股票質押' : ''}利息後（進階匯入）`, ltlRole: 'adv', data, borderColor: pal.adv, backgroundColor: pal.adv, borderWidth: 3, borderDash: [14, 4, 2, 4], pointRadius: 0, pointHoverRadius: 4, fill: false });
  }
  if (p.adv) {
    const sp = { monthly: p.monthly, startAge: p.startAge, stopAge: p.stopAge };
    const data = incomeSeries(sp, p.xFrom, p.xTo).map((d) => ({ x: d.x, y: advancedNet(p.adv.data, p.adv.todayYm, p.today, d.x, d.y, { withPrincipal: true }) }));
    datasets.push({ label: `扣除生活支出月平均與實際月繳（本金＋利息${p.adv.data.pledge ? '，含股票質押利息' : ''}）後（進階匯入）`, ltlRole: 'pay', data, borderColor: pal.pay, backgroundColor: pal.pay, borderWidth: 3, borderDash: [3, 3], pointRadius: 0, pointHoverRadius: 4, fill: false });
  }
  datasets.forEach((ds, i) => { if (!ds.ltlRole) ds.ltlRole = i === 0 ? 'main' : 'base'; });
  const base = {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: reducedMotion() || printing ? false : { duration: 300 },
      parsing: false, interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { type: 'linear', min: p.xFrom, max: p.xTo, title: { display: true, text: '年齡（歲）', color: pal.ink }, ticks: { color: pal.muted, callback: (v) => ageText(v) }, grid: { color: pal.grid } },
        y: { beginAtZero: true, title: { display: true, text: '累積收入（NT$）', color: pal.ink }, ticks: { color: pal.muted, callback: (v) => v.toLocaleString('en-US') }, grid: { color: pal.grid } },
      },
      plugins: {
        legend: { display: true, position: 'top', align: 'start', labels: { color: pal.ink, boxWidth: 18, usePointStyle: false } },
        tooltip: { callbacks: { title: (it) => `${ageText(it[0].parsed.x)} 歲`, label: (it) => `${it.dataset.label.split('（')[0]}：${money(it.parsed.y)}` } },
        ltlMarkers: { stop: p.stopAge, today: p.today, pal },
      },
    },
    plugins: [markers],
  };
  if (chart) { chart.destroy(); chart = null; }
  chart = new Chart(canvas, base);
  if (printing) setPrintMode(true);
  return chart;
}

export function destroyCurve() { if (chart) { chart.destroy(); chart = null; } }

/** 列印：固定 720×360、解析度 2；呼叫端負責在 afterprint 還原。 */
export function setPrintMode(on) {
  printing = on;
  if (!chart) return;
  chart.options.animation = false;
  applyPalette(chart, on ? PRINT_PAL : palette());
  chart.options.devicePixelRatio = on ? 2 : globalThis.devicePixelRatio || 1;
  if (on) chart.resize(720, 360); else chart.resize();
  chart.update('none');
}

export function curveTable(tableEl, p) {
  const main = incomeSeries({ monthly: p.monthly, startAge: p.startAge, stopAge: p.stopAge }, p.xFrom, p.xTo);
  const base = p.base;
  const sp = { monthly: p.monthly, startAge: p.startAge, stopAge: p.stopAge };
  const rows = main.map((d) => ({ x: d.x, y: d.y, b: base ? cumulativeIncome(base, d.x) : null, n: p.expense > 0 ? netCumulative(sp, p.expense, p.today, d.x) : null })).filter((d, i, a) => i === 0 || i === a.length - 1 || Math.round(d.x) % 5 === 0);
  const th = (t) => { const e = document.createElement('th'); e.scope = 'col'; e.textContent = t; return e; };
  const td = (t) => { const e = document.createElement('td'); e.textContent = t; return e; };
  const head = document.createElement('tr'); head.append(th('年齡（歲）'), th('從現在開始（NT$）'));
  if (base) head.append(th('18 歲起領基本工資（NT$）'));
  if (p.expense > 0) head.append(th('扣除每月消費後（NT$）'));
  if (p.adv) head.append(th('扣除生活支出與借款利息後（進階，NT$）'), th('扣除生活支出與實際月繳後（進階，NT$）'));
  const body = rows.map((d) => { const tr = document.createElement('tr'); tr.append(td(ageText(d.x)), td(money(d.y))); if (base) tr.append(td(money(d.b))); if (p.expense > 0) tr.append(td(money(d.n))); if (p.adv) tr.append(td(money(advancedNet(p.adv.data, p.adv.todayYm, p.today, d.x, d.y))), td(money(advancedNet(p.adv.data, p.adv.todayYm, p.today, d.x, d.y, { withPrincipal: true })))); return tr; });
  tableEl.replaceChildren(head, ...body);
}
