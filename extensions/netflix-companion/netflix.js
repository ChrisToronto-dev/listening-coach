(() => {
  let range = null, owner = null, lastContact = 0, lastSeek = 0, seeking = false, ticking = false, error = '', episode = location.pathname;
  const video = () => [...document.querySelectorAll('video')].find(v => v.duration > 0 && v.getBoundingClientRect().width > 0);
  const reset = () => { range = null; owner = null; error = ''; };
  async function native(action, extra = {}) {
    const result = await chrome.runtime.sendMessage({ source: 'listening-coach-native', command: { action, watchId: episode.match(/^\/watch\/(\d+)/)?.[1], ...extra } });
    if (!result || result.failed) throw Error(result?.error || 'Could not connect to the Netflix player. Refresh the extension and both tabs.');
    return result;
  }
  async function seek(time) {
    if (seeking) throw Error('Wait for the previous seek to finish.');
    seeking = true;
    const path = episode;
    try {
      await native('seek', { time });
      // Wait for native buffering; never fall back to assigning video.currentTime.
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (location.pathname !== path) throw Error('The episode changed, so seeking was stopped.');
        if (Math.abs((await native('status')).time - time) < 3) return;
      }
      throw Error('Could not confirm the seek, so repeat was turned off. Check playback in the Netflix tab.');
    } finally { seeking = false; }
  }
  async function status(v) {
    const timing = v ? await native('status') : { time: 0, duration: 0 };
    // innerText preserves rendered <br> / block boundaries that textContent drops.
    const subtitle = (document.querySelector('.player-timedtext-text-container')?.innerText ?? '')
      .replace(/\u00a0/g, ' ').split(/\r?\n/).map(line => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, 2000);
    return { watchId: location.pathname.match(/^\/watch\/(\d+)/)?.[1], ready: !!v,
      ...timing, paused: v?.paused ?? true, loop: !!range?.loop, start: range?.start, end: range?.end, error,
      subtitle };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.source !== 'listening-coach-controller') return false;
    async function act() {
      if (episode !== location.pathname) { reset(); episode = location.pathname; }
      const c = message.command, v = video();
      if (location.pathname !== '/watch/' + c.watchId && location.pathname !== '/watch/' + c.watchId + '/') throw Error('Netflix moved to another episode. Reconnect it from the app.');
      if (owner !== null && owner !== message.owner && Date.now() - lastContact < 15000) throw Error('Another learning-app tab is connected. Disconnect it first.');
      if (c.action === 'disconnect') { reset(); return { ready: false, loop: false }; }
      owner = message.owner; lastContact = Date.now();
      if (c.action === 'status') return status(v);
      if (!v) throw Error('Play the Netflix title first.');
      error = '';
      if (c.action === 'play' || c.action === 'pause') await native(c.action);
      else if (c.action === 'seek') { if (range && (c.time < range.start || c.time >= range.end)) range.loop = false; await seek(c.time); }
      else if (c.action === 'range') {
        const timing = await native('status');
        if (!(Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end > c.start && c.end <= timing.duration)) throw Error('Set the end time after the start time and within the video duration.');
        const next = { start: c.start, end: c.end, loop: false }; range = next;
        if (c.loop) { await seek(c.start); if (range === next && episode === location.pathname) next.loop = true; }
      } else throw Error('Unsupported command.');
      return status(v);
    }
    act().then(respond, e => { if (owner === message.owner) { error = e.message; if (range) range.loop = false; } respond({ error: e.message, failed: true }); });
    return true;
  });
  setInterval(async () => {
    if (episode !== location.pathname || Date.now() - lastContact > 15000) { reset(); episode = location.pathname; return; }
    const v = video();
    if (!v || !range?.loop || seeking || ticking || (v.paused && !v.ended) || v.seeking || v.readyState < 2 || Date.now() - lastSeek < 1200) return;
    ticking = true;
    const activeRange = range;
    try {
      const timing = await native('status');
      if (range !== activeRange || !range.loop || episode !== location.pathname || Date.now() - lastContact > 15000 || timing.time < range.end - .1) return;
      lastSeek = Date.now();
      const ended = v.ended;
      await seek(range.start);
      if (ended && range === activeRange && range.loop) await native('play');
    } catch (e) { error = e.message; if (range) range.loop = false; }
    finally { ticking = false; }
  }, 250);
})();
