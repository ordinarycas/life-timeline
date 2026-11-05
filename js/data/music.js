// 背景音樂預設清單（music.json）：YouTube 影片，由使用者按下播放才載入嵌入播放器；使用者也可以貼自己的 YouTube 網址。
export let MUSIC = [];
export function initMusic(list) { MUSIC = Object.freeze(list); }
