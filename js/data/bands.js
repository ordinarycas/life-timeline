// 時間軸上的三個年齡階段（24 歲起，每四年一個階段、前後連續）：畫成貫穿整張圖的淡色底，標示在刻度下方。
// 標示文字依使用者指定的 24–28、29–32、33–36 歲；畫的位置是連續的 24–28、28–32、32–36。
// 這是本站規劃用的分段，不是法規或官方資料。
export const BANDS = Object.freeze([
  { from: 24, to: 28, label: '24–28' },
  { from: 28, to: 32, label: '29–32' },
  { from: 32, to: 36, label: '33–36' },
]);

/** 每段的寬度（像素）決定怎麼標：夠寬寫「24–28 歲」；次之寫「24–28」；太窄（手機 100%）只標最前面的 24 和最後面的 36。 */
export function bandMode(width) { return width >= 64 ? 'full' : width >= 40 ? 'short' : 'ends'; }
export const bandEnds = () => [{ at: BANDS[0].from, text: String(BANDS[0].from) }, { at: BANDS.at(-1).to, text: String(BANDS.at(-1).to) }];

export const bandText = (b, short = false) => `${b.label}${short ? '' : ' 歲'}`;
