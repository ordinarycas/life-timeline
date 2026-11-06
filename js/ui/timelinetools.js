// 時間軸工具列：縮放、分享圖片、下載圖片、列印圖片。圖片由 timelineimage.js 畫出（含已走過的階段，淺色）。
import { toast } from './dom.js';
import { fontsReady } from './fonts.js';
import { drawTimelineImage, canvasBlob } from './timelineimage.js';

const FILE = 'life-timeline.png';

/**
 * @param {{timeline:object, els:{zoomIn:HTMLElement, zoomOut:HTMLElement, zoomReset:HTMLElement, share:HTMLElement, download:HTMLElement, print:HTMLElement, sheet:HTMLElement, img:HTMLImageElement, title:HTMLElement, sub:HTMLElement}}} o
 * @returns {{onZoom:(z:number)=>void}}
 */
export function initTimelineTools({ timeline, els }) {
  const busy = (btn, on) => { btn.disabled = on; };

  async function makeCanvas() {
    const model = timeline.model;
    if (!model) throw new Error('no model');
    await fontsReady();
    return drawTimelineImage(model, { title: els.title.textContent, sub: els.sub.textContent });
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
      await navigator.share({ files: [file], title: '我的人生時間軸' });
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

  els.zoomIn.addEventListener('click', () => timeline.zoomBy(1.25));
  els.zoomOut.addEventListener('click', () => timeline.zoomBy(1 / 1.25));
  els.zoomReset.addEventListener('click', () => timeline.zoomReset());
  return { onZoom: (z) => { els.zoomReset.textContent = `${Math.round(z * 100)}%`; } };
}
