export function isLocalApp(url) {
  try { const parsed = new URL(url); return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname); }
  catch { return false; }
}
export function watchId(url) {
  try { const u = new URL(url); return u.origin === 'https://www.netflix.com' ? u.pathname.match(/^\/watch\/(\d+)\/?$/)?.[1] ?? null : null; }
  catch { return null; }
}
export function validCommand(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.action === 'ping' || p.action === 'list') return true;
  if (!Number.isSafeInteger(p.tabId) || p.tabId < 0 || !/^\d{1,20}$/.test(p.watchId ?? '')) return false;
  if (['status', 'play', 'pause', 'disconnect'].includes(p.action)) return true;
  if (p.action === 'seek') return Number.isFinite(p.time) && p.time >= 0 && p.time <= 86400;
  return p.action === 'range' && Number.isFinite(p.start) && Number.isFinite(p.end) && p.start >= 0 && p.end > p.start && p.end <= 86400 && typeof p.loop === 'boolean';
}
