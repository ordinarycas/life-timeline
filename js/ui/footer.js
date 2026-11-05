// 區塊 4：頁尾（更新時間、版權、版本號、檢查更新、開源與隱私說明）。
import { h } from './dom.js';
import { APP_VERSION, BUILD_ID, BUILD_DATE } from '../core/build.js';
import { WAGE_SOURCE } from '../data/wage.js';

export function renderFooter({ onCheck }) {
  const $ = (id) => document.getElementById(id);
  $('f-updated').textContent = `網站更新時間：${BUILD_DATE}（法規與統計資料的查閱日期見各標籤的來源）`;
  $('f-copy').textContent = '© 2026 LifeTimeline。保留所有權利。';
  const btn = h('button', { type: 'button', class: 'btn', text: '檢查更新', onclick: onCheck });
  $('f-version').replaceChildren(`版本 v${APP_VERSION}（${BUILD_ID.replace('ltl-', '#')}）`, btn);
  $('f-oss').replaceChildren('使用的開放原始碼：Chart.js（MIT 授權）；字型：Noto Sans TC（SIL Open Font License 1.1，由 Google Fonts 提供）。基本工資依',
    h('a', { href: WAGE_SOURCE.url, target: '_blank', rel: 'noopener noreferrer', text: `${WAGE_SOURCE.publisher}《${WAGE_SOURCE.title}》` }), `（查閱 ${WAGE_SOURCE.accessed}）。`);
  $('f-disclaimer').textContent = '本站內容是規劃參考，不是法律、財務或投資建議，也不預測壽命；實際規定請以主管機關公告為準。你輸入的資料只存在這個瀏覽器。';
}
