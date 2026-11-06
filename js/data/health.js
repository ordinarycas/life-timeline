// 健康參考圖層（選用、預設隱藏）：各器官「平均開始變化」與「加速變化」的年齡。
// 注意：這不是官方資料。來源是民間媒體 50+（遠見天下文化）整理的圖表，文中沒有列出研究出處；僅供參考，不是醫療建議。
// 所以它不放在 tags.json（那裡每個標籤都要有官方來源），也沒有詳細說明卡片。
export const HEALTH_SOURCE = Object.freeze({
  publisher: '50+（遠見天下文化出版）',
  title: '眼睛、腸胃、大腦幾歲開始變老？14種人體器官平均退化年齡表，掌握黃金時間提早預防',
  url: 'https://www.fiftyplus.com.tw/articles/30833',
  accessed: '2026-11-06',
  role: 'secondary',
});

/** accel 是數字（那個年齡開始加速）或 [起, 迄]（區間）。audience：all／male／female。common 是圖表標示的好發狀況（只有圖上有的才寫）。 */
export const ORGANS = Object.freeze([
  { id: 'gut', label: '腸道', onset: 3, accel: 50, audience: 'all', common: '大腸癌' },
  { id: 'eye', label: '眼睛', onset: 6, accel: 40, audience: 'all', common: '乾眼症、飛蚊症' },
  { id: 'heart', label: '心血管系統', onset: 20, accel: 60, audience: 'all', common: '高血壓、冠心病' },
  { id: 'skin', label: '皮膚', onset: 20, accel: 50, audience: 'all', common: '色素斑、皮膚癌' },
  { id: 'stomach', label: '胃部', onset: 20, accel: 50, audience: 'all', common: '胃炎、胃潰瘍' },
  { id: 'male-repro', label: '男性生殖系統', onset: 20, accel: [40, 60], audience: 'male', common: '更年早衰、攝護腺腫大' },
  { id: 'brain', label: '腦部', onset: 25, accel: 70, audience: 'all', common: '記憶力退化、認知衰退' },
  { id: 'female-repro', label: '女性生殖系統', onset: 30, accel: [35, 40], audience: 'female', common: '' },
  { id: 'bone', label: '骨骼', onset: 30, accel: 50, audience: 'all', common: '' },
  { id: 'lung', label: '肺部', onset: 30, accel: [60, 70], audience: 'all', common: '' },
  { id: 'kidney', label: '腎臟', onset: 30, accel: 80, audience: 'all', common: '' },
  { id: 'joint', label: '關節', onset: 35, accel: 50, audience: 'all', common: '' },
  { id: 'liver', label: '肝臟', onset: 40, accel: 65, audience: 'all', common: '' },
]);

export const accelFrom = (o) => (Array.isArray(o.accel) ? o.accel[0] : o.accel);
export const accelText = (o) => (Array.isArray(o.accel) ? `${o.accel[0]}～${o.accel[1]} 歲` : `${o.accel} 歲`);
