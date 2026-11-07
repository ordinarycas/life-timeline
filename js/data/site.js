// 網站名稱、簡介與分享用網址：分享、下載、列印的圖片最下方會附上，讓看到圖片的人知道怎麼使用。
export const SITE_NAME = 'LifeTimeline｜人生時間軸與薪資收入';
export const SITE_INTRO = '給台灣人的人生時間軸：輸入生日、性別與月薪，看學制、兵役、駕照、退休規定等人生階段，以及只領基本工資至少能賺多少。免費、不用註冊，資料只存在你自己的瀏覽器，可離線使用。';
/** 正式網址。留空就用目前頁面的網址（本機開發時不顯示網址）。 */
export const SITE_URL = '';

/** 用文字分享時的內容：一句話加上連結（連結放在最後，聊天軟體會自動變成可以點的連結）。 */
export function shareText(url) {
  return url ? `我用 LifeTimeline 排了人生時間軸，你也來試試：${url}` : '我用 LifeTimeline 排了人生時間軸。';
}

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/;

/** 圖片上要印的網址：只含網站位置，不含 # 或 ? 後面的任何東西；不是公開網址（本機、file://）回傳空字串。 */
export function shareUrl(loc = globalThis.location, fixed = SITE_URL) {
  if (fixed) return fixed;
  if (!loc || !/^https?:$/.test(loc.protocol) || LOCAL.test(loc.hostname)) return '';
  return `${loc.origin}${loc.pathname.replace(/index\.html$/, '')}`;
}
