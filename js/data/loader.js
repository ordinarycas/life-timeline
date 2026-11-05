// 載入內容資料（JSON）。readJson(name) 由呼叫端提供：瀏覽器用 fetchJson，Node 用 fs。
import { initTags } from './tags.js';
import { initMusic } from './music.js';
import { initWage } from './wage.js';
import { initLifeTable } from './life-table.js';
import { initIncome } from './income.js';

export async function loadContent(readJson) {
  const [tags, music, wage, life, income] = await Promise.all(['tags.json', 'music.json', 'wage.json', 'life-table.json', 'income.json'].map(readJson));
  initTags(tags); initMusic(music); initWage(wage); initLifeTable(life); initIncome(income);
}

export async function fetchJson(name) {
  const res = await fetch(new URL(`js/data/${name}`, document.baseURI));
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}
