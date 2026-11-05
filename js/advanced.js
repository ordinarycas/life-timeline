// 進階頁：匯入由 Excel 轉出的 JSON（生活支出月平均 + 借款利息），顯示摘要；資料只存在這個瀏覽器。
import { h, clear } from './ui/dom.js';
import { applyTheme } from './ui/theme.js';
import { money } from './core/format.js';
import { todayTaipei } from './core/clock.js';
import { parseAdvanced, loadAdvanced, saveAdvanced, clearAdvanced, advancedSummary } from './core/advanced.js';

const $ = (id) => document.getElementById(id);
const MAX_BYTES = 500 * 1024;

function render() {
  const adv = loadAdvanced();
  const box = $('adv-summary'); clear(box);
  $('adv-clear').hidden = !adv;
  if (!adv) { box.append(h('p', { text: '目前沒有匯入資料。匯入後，首頁的「累積收入曲線」會多一條線。' })); return; }
  const s = advancedSummary(adv, todayTaipei().slice(0, 7));
  const card = (k, v, note) => h('div', {}, h('dt', { text: k }), h('dd', {}, v, note ? h('span', { class: 'sub', text: note }) : null));
  box.append(
    h('p', {}, h('strong', { text: '已匯入' }), `（資料日期 ${adv.exportedAt || '未標示'}）`),
    h('dl', { class: 'kpi' },
      card('生活支出（每月平均）', money(adv.livingMonthlyAvg)),
      card('今天起借款利息合計', money(s.interest), s.lastYm ? `最後一期 ${s.lastYm}` : '沒有未來的借款'),
      card('今天起借款本金合計', money(s.principal), '還本金是把負債還掉，曲線只扣利息'),
    ),
    s.byYear.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, ['年度', '利息（NT$）', '本金（NT$）'].map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, s.byYear.map((y) => h('tr', {}, h('th', { scope: 'row', text: y.year }), h('td', { text: money(y.interest) }), h('td', { text: money(y.principal) })))))) : null,
  );
}

function setStatus(text, bad = false) { const e = $('adv-status'); e.textContent = text; e.classList.toggle('is-bad', bad); }

$('adv-file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > MAX_BYTES) { setStatus('檔案太大（超過 500 KB），這不像是轉出的進階資料。', true); return; }
  try {
    const adv = parseAdvanced(JSON.parse(await f.text()));
    saveAdvanced(adv);
    setStatus(`匯入成功：${adv.months.length} 個月的借款資料。回首頁查看累積收入曲線。`);
  } catch (err) { setStatus(`匯入失敗：${err instanceof SyntaxError ? '檔案不是 JSON 格式。' : err.message}`, true); }
  render();
});
$('adv-clear').addEventListener('click', () => { clearAdvanced(); setStatus('已清除匯入的資料。'); render(); });

try {
  const p = JSON.parse(localStorage.getItem('ltl.prefs.v1') || 'null');
  if (p?.theme === 'dark' || p?.theme === 'auto') applyTheme(p.theme);
} catch { /* 維持預設淺色 */ }
render();
