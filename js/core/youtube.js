// YouTube 網址解析（純函式）。只接受 youtube.com／youtu.be／youtube-nocookie.com 的 watch、embed、shorts、live、youtu.be 短網址，
// 取出 11 碼影片 ID；其餘一律回 null（不信任任意網址）。
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be']);

export function parseYoutubeId(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (!['https:', 'http:'].includes(u.protocol) || !HOSTS.has(u.hostname.toLowerCase())) return null;
  let id = null;
  if (u.hostname.toLowerCase() === 'youtu.be') id = u.pathname.split('/')[1];
  else if (u.pathname === '/watch') id = u.searchParams.get('v');
  else { const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname); id = m?.[1]; }
  return id && ID.test(id) ? id : null;
}

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&loop=1&playlist=${id}&rel=0`;
