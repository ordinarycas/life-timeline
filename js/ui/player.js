// 左下角半透明播放器：選預設曲目或貼上 YouTube 網址，按「播放」才載入 youtube-nocookie 嵌入播放器（之前不會連線到 YouTube）。
// 嵌入播放器必須看得見（YouTube 條款不允許隱藏），所以顯示一個小視窗。
import { h, clear } from './dom.js';
import { MUSIC } from '../data/music.js';
import { parseYoutubeId, watchUrl, embedUrl } from '../core/youtube.js';

export function initPlayer(root, prefs, onChange, { collapsed = false, onCollapse = () => {} } = {}) {
  clear(root);
  const sel = h('select', { id: 'pl-sel', 'aria-label': '選擇預設曲目' }, h('option', { value: 'custom', text: '自己貼網址' }),
    ...MUSIC.map((m) => h('option', { value: m.id, text: `${m.artist}｜${m.title}` })));
  const input = h('input', { type: 'url', id: 'pl-url', inputmode: 'url', placeholder: '貼上 YouTube 網址', 'aria-label': 'YouTube 網址', 'aria-describedby': 'pl-err pl-note', autocomplete: 'off' });
  const err = h('p', { class: 'err', id: 'pl-err', role: 'alert', hidden: true });
  const play = h('button', { type: 'button', class: 'btn', text: '播放' });
  const box = h('div', { class: 'yt', hidden: true });
  const link = h('a', { class: 'pl-link', target: '_blank', rel: 'noopener noreferrer', text: '無法播放？在 YouTube 開啟', hidden: true });
  const note = h('p', { class: 'hint', id: 'pl-note', text: '預設不播放；按下播放後才會連線到 YouTube（youtube-nocookie.com），YouTube 會收到你的 IP 與瀏覽器資訊。' });
  let playing = false;

  const preset = (id) => MUSIC.find((m) => m.id === id);
  const stop = () => { clear(box); box.hidden = true; link.hidden = true; playing = false; play.textContent = '播放'; };
  const showErr = (m) => { err.hidden = !m; err.textContent = m ?? ''; if (m) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); };

  // 初始值：已儲存的預設曲目或自訂網址；都沒有就帶入第一首預設
  const saved = preset(prefs.music);
  if (saved) { sel.value = saved.id; input.value = saved.url; }
  else if (prefs.music === 'custom' && prefs.musicUrl) { sel.value = 'custom'; input.value = prefs.musicUrl; }
  else if (MUSIC[0]) { sel.value = MUSIC[0].id; input.value = MUSIC[0].url; }

  sel.addEventListener('change', () => {
    stop(); showErr(null);
    const m = preset(sel.value);
    if (m) { input.value = m.url; onChange({ music: m.id }); } else { input.value = ''; input.focus(); onChange({ music: 'custom', musicUrl: '' }); }
  });
  input.addEventListener('input', () => {
    const id = parseYoutubeId(input.value);
    if (input.value.trim() && !id) { showErr('這不是有效的 YouTube 網址'); return; }
    showErr(null);
    const m = MUSIC.find((x) => x.youtube === id);
    sel.value = m ? m.id : 'custom';
    onChange(m ? { music: m.id } : { music: 'custom', musicUrl: id ? watchUrl(id) : '' });
  });
  play.addEventListener('click', () => {
    if (playing) { stop(); return; }
    const id = parseYoutubeId(input.value);
    if (!id) { showErr(input.value.trim() ? '這不是有效的 YouTube 網址' : '請先貼上 YouTube 網址'); input.focus(); return; }
    showErr(null);
    box.append(h('iframe', {
      src: embedUrl(id), title: 'YouTube 背景音樂播放器', allow: 'autoplay; encrypted-media; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy',
    }));
    link.href = watchUrl(id); link.hidden = false;
    box.hidden = false; playing = true; play.textContent = '停止';
  });

  const body = h('div', { class: 'pl-body' }, sel, h('div', { class: 'row2' }, input, play), err, box, link, note);
  const toggle = h('button', { type: 'button', class: 'xbtn', onclick: () => { collapsed = !collapsed; sync(); onCollapse(collapsed); } });
  const sync = () => {
    root.classList.toggle('is-collapsed', collapsed);
    toggle.textContent = collapsed ? '＋' : '－';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? '展開背景音樂' : '收合背景音樂');
  };
  root.append(h('div', { class: 'pl-head' }, h('h3', { text: '背景音樂' }), toggle), body);
  sync();
  // 平常只有 20% 明度；滑鼠移過或鍵盤聚焦才完整顯示。觸控裝置沒有 hover，點一下面板後保持清楚，點別處再淡出。
  root.addEventListener('pointerdown', () => root.classList.add('is-active'));
  document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) root.classList.remove('is-active'); });
}
