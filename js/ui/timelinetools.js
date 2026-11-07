// 時間軸工具列：縮放、分享圖片、下載圖片、列印圖片。圖片由 timelineimage.js 畫出（含已走過的階段，淺色）。
import { toast } from './dom.js';
import { fontsReady } from './fonts.js';
import { drawTimelineImage, canvasBlob } from './timelineimage.js';
import { drawCurveSection, drawAssetsSection, drawPromoSection, composeSections } from './imagesections.js';
import { shareUrl, shareText } from '../data/site.js';

const FILE = 'life-timeline.png';

/**
 * @param {{timeline:object, els:{zoomIn:HTMLElement, zoomOut:HTMLElement, zoomReset:HTMLElement, share:HTMLElement, download:HTMLElement, print:HTMLElement, sheet:HTMLElement, img:HTMLImageElement, title:HTMLElement, sub:HTMLElement}}} o
 * @returns {{onZoom:(z:number)=>void}}
 */
export function initTimelineTools({ timeline, els, getExtras = () => ({}), initial = {}, onOpt = () => {} }) {
  const busy = (btn, on) => { btn.disabled = on; };

  async function makeCanvas() {
    const model = timeline.model;
    if (!model) throw new Error('no model');
    await fontsReady();
    const base = drawTimelineImage(model, { title: els.title.textContent, sub: els.sub.textContent });
    // 使用者勾選的附加內容：累積收入曲線、資產與負債（沒有資料的選項是停用的，不會畫）
    const ex = getExtras();
    const sections = [];
    if (els.optCurve.checked && !els.optCurve.disabled && ex.curve) sections.push(await drawCurveSection(ex.curve));
    if (els.optAssets.checked && !els.optAssets.disabled && ex.assets) sections.push(drawAssetsSection(ex.assets));
    sections.push(drawPromoSection({ url: shareUrl() })); // 最下方一律附上網站簡介與網址
    return composeSections(base, sections);
  }
  function saveBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = FILE; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function run(btn, fn) {
    busy(btn, true);
    try { await fn(); } catch (e) { if (e?.name !== 'AbortError') toast('產生圖片失敗，請稍後再試。'); } finally { busy(btn, false); }
  }

  els.download.addEventListener('click', () => run(els.download, async () => { saveBlob(await canvasBlob(await makeCanvas())); toast('已下載時間軸圖片。'); }));
  els.share.addEventListener('click', () => run(els.share, async () => {
    const blob = await canvasBlob(await makeCanvas());
    const file = new File([blob], FILE, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '我的人生時間軸', text: shareText(shareUrl()) }); // 連結放在文字裡，對方的聊天軟體會顯示成可以點的連結
    } else {
      saveBlob(blob); toast('這個瀏覽器不能直接分享圖片，已改為下載。');
    }
  }));
  els.print.addEventListener('click', () => run(els.print, async () => {
    const canvas = await makeCanvas();
    els.img.src = canvas.toDataURL('image/png');
    await els.img.decode?.().catch(() => {});
    document.body.classList.add('print-image');
    const done = () => { document.body.classList.remove('print-image'); els.img.removeAttribute('src'); removeEventListener('afterprint', done); };
    addEventListener('afterprint', done);
    print();
  }));

  // 只分享連結（文字）：支援的瀏覽器開分享面板，否則複製到剪貼簿，貼到任何聊天軟體都是可以點的連結
  els.shareLink.addEventListener('click', async () => {
    const url = shareUrl();
    if (!url) { toast('目前是本機或檔案開啟，沒有公開網址可以分享；部署到網站後才能分享連結。', 6000); return; }
    const text = shareText(url);
    try {
      if (navigator.share) { await navigator.share({ title: 'LifeTimeline 人生時間軸', text }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('已複製連結，可以貼到聊天軟體。'); } catch { toast(`請自行複製這個連結：${url}`, 8000); }
  });
  els.optCurve.checked = !!initial.curve;
  els.optAssets.checked = !!initial.assets;
  els.optCurve.addEventListener('change', () => onOpt('curve', els.optCurve.checked));
  els.optAssets.addEventListener('change', () => onOpt('assets', els.optAssets.checked));
  const setAvail = (box, ok, label, why) => {
    box.disabled = !ok;
    box.closest('label').title = ok ? '' : why;
    box.closest('label').querySelector('span').textContent = ok ? label : `${label}（${why}）`;
  };

  els.zoomIn.addEventListener('click', () => timeline.zoomBy(1.25));
  els.zoomOut.addEventListener('click', () => timeline.zoomBy(1 / 1.25));
  els.zoomReset.addEventListener('click', () => timeline.zoomReset());
  return {
    onZoom: (z) => { els.zoomReset.textContent = `${Math.round(z * 100)}%`; },
    /** 目前有沒有資料可以放進圖片。 */
    setAvailable({ curve, assets }) {
      setAvail(els.optCurve, curve, '累積收入曲線', '目前沒有可畫的收入');
      setAvail(els.optAssets, assets, '資產與負債', '還沒填資產、借款或支出');
    },
  };
}
