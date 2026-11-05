// 列印：按鈕等字型就緒後呼叫 window.print()；beforeprint／afterprint 時展開已走過的階段、固定時間軸寬度、圖表換淺色尺寸。
import { fontsReady } from './fonts.js';

const PRINT_WIDTH = 940; // A4 橫向，10mm 邊界後約 970px，扣掉卡片邊框

export function initPrint({ buttons, timeline, curve, detailsToOpen }) {
  let saved = null;
  const before = () => {
    if (saved) return;
    saved = { expanded: timeline.setExpanded(true), opened: detailsToOpen.map((d) => d.open) };
    timeline.setForcedWidth(PRINT_WIDTH);
    detailsToOpen.forEach((d) => { d.open = true; });
    curve.setPrintMode(true);
  };
  const after = () => {
    if (!saved) return;
    timeline.setForcedWidth(null);
    timeline.setExpanded(saved.expanded);
    detailsToOpen.forEach((d, i) => { d.open = saved.opened[i]; });
    curve.setPrintMode(false);
    saved = null;
  };
  addEventListener('beforeprint', before);
  addEventListener('afterprint', after);
  for (const b of buttons) b.addEventListener('click', async () => { await fontsReady(); print(); });
}
