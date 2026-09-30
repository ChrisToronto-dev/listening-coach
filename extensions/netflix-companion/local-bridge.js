(() => {
  if (!['http://127.0.0.1:5173', 'http://localhost:5173'].includes(location.origin) || window.top !== window) return;
  window.addEventListener('message', async event => {
    const m = event.data;
    if (event.source !== window || event.origin !== location.origin || m?.source !== 'listening-coach-page' || typeof m.id !== 'string' || m.id.length > 80) return;
    let result;
    try { result = await chrome.runtime.sendMessage({ source: 'listening-coach-local', command: m.command }); }
    catch { result = { ok: false, error: 'If you reloaded the extension, refresh both the learning app and Netflix.' }; }
    window.postMessage({ source: 'listening-coach-extension', id: m.id, ...result }, location.origin);
  });
})();
