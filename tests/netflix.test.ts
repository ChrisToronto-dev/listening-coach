import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isLocalApp, watchId, validCommand } from '../extensions/netflix-companion/protocol.js';
import { netflixControl } from '../extensions/netflix-companion/player-control.js';

test('Netflix bridge only accepts the exact local app and Netflix watch pages', () => {
  assert.equal(isLocalApp('http://127.0.0.1:5173/netflix'), true);
  assert.equal(isLocalApp('http://localhost:5173/netflix'), true);
  for (const url of ['https://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1.evil.test:5173', 'https://example.com']) assert.equal(isLocalApp(url), false);
  assert.equal(watchId('https://www.netflix.com/watch/12345?trackId=1'), '12345');
  for (const url of ['https://www.netflix.com/login', 'https://www.netflix.com.evil.test/watch/1', 'http://www.netflix.com/watch/1']) assert.equal(watchId(url), null);
  assert.equal(validCommand({ action: 'range', tabId: 5, watchId: '123', start: 2, end: 8, loop: true }), true);
  for (const c of [{ action: 'eval' }, { action: 'seek', tabId: 5, watchId: '123', time: -1 }, { action: 'range', tabId: 5, watchId: '123', start: 9, end: 8, loop: true }]) assert.equal(validCommand(c), false);
});

function playerHarness() {
  let listener: (m: unknown, s: unknown, respond: (r: Record<string, unknown>) => void) => void;
  let tick: () => Promise<void> = async () => {};
  let now = 100000;
  const state = { time: 0, ignoreSeek: false, available: true, commands: [] as number[] };
  const video = { duration: 120, get currentTime() { return 9000; }, set currentTime(_v: number) { throw Error('M7375: direct HTML video seeking'); }, paused: false, seeking: false, readyState: 4, getBoundingClientRect: () => ({ width: 800 }) };
  const location = { origin: 'https://www.netflix.com', pathname: '/watch/123' };
  const subtitle = { innerText: 'Hello there.', textContent: 'Hello there.' };
  const p = { getCurrentTime: () => state.time * 1000, getDuration: () => 120000, seek: (ms: number) => { state.commands.push(ms); if (!state.ignoreSeek) state.time = ms / 1000; }, play: () => { video.paused = false; }, pause: () => { video.paused = true; } };
  const api = { getAllPlayerSessionIds: () => ['preview-0', 'watch-123'], getVideoPlayerBySessionId: (id: string) => { assert.equal(id, 'watch-123'); return p; } };
  const native = (command: unknown) => vm.runInNewContext('(' + netflixControl.toString() + ')(command)', { command, location, window: state.available ? { netflix: { appContext: { state: { playerApp: { getAPI: () => ({ videoPlayer: api }) } } } } } : {} });
  vm.runInNewContext(readFileSync(new URL('../extensions/netflix-companion/netflix.js', import.meta.url), 'utf8'), {
    chrome: { runtime: { id: 'test-extension', sendMessage: ({ command }: { command: unknown }) => native(command), onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } } },
    document: { querySelectorAll: () => [video], querySelector: () => subtitle },
    location, Date: { now: () => now }, setTimeout: (fn: () => void) => { fn(); }, setInterval: (fn: typeof tick) => { tick = fn; },
  });
  return { video, state, location, subtitle, native, tick: () => tick(), advance: (ms: number) => { now += ms; },
    send: (action: string, extra = {}, owner = 1) => new Promise<Record<string, unknown>>(resolve => listener({ source: 'listening-coach-controller', owner, command: { action, watchId: '123', ...extra } }, { id: 'test-extension' }, resolve)) };
}
test('Netflix caption capture preserves rendered line breaks instead of concatenated textContent', async () => {
  const h = playerHarness();
  h.subtitle.textContent = "Why don't you tell heryou can't drive her today,";
  h.subtitle.innerText = "  Why don't you tell her\nyou can't drive her today,  ";
  assert.equal((await h.send('status')).subtitle, "Why don't you tell her\nyou can't drive her today,");
  h.subtitle.innerText = 'First\u00a0speaker.\n\n Second\t speaker.';
  assert.equal((await h.send('status')).subtitle, 'First speaker.\nSecond speaker.');
  h.subtitle.innerText = '';
  assert.equal((await h.send('status')).subtitle, '');
});
test('Netflix loop repeats, stops when unchecked, and leaves normal playback running', async () => {
  const h = playerHarness();
  await h.send('range', { start: 10, end: 20, loop: true });
  h.state.time = 20; await h.tick();
  assert.equal(h.state.time, 10); assert.deepEqual(h.state.commands, [10000, 10000]);
  await h.send('range', { start: 10, end: 20, loop: false });
  h.state.time = 25; h.advance(2000); await h.tick();
  assert.equal(h.state.time, 25); assert.equal(h.video.paused, false);
});
test('Netflix rejects invalid range and conflicting controllers, releases on disconnect', async () => {
  const h = playerHarness();
  assert.equal((await h.send('range', { start: 10, end: 130, loop: true })).failed, true);
  await h.send('range', { start: 10, end: 20, loop: true });
  assert.equal((await h.send('pause', {}, 2)).failed, true);
  assert.equal((await h.send('status')).loop, true);
  await h.send('disconnect');
  assert.equal((await h.send('status', {}, 2)).loop, false);
});
test('Netflix loop expires after app disconnect and never follows a new episode', async () => {
  const h = playerHarness();
  await h.send('range', { start: 10, end: 20, loop: true });
  h.advance(16000); h.state.time = 25; await h.tick();
  assert.equal(h.state.time, 25); assert.equal((await h.send('status')).loop, false);
  await h.send('range', { start: 10, end: 20, loop: true });
  h.location.pathname = '/watch/456'; h.state.time = 25; await h.tick();
  assert.equal(h.state.time, 25); assert.equal((await h.send('play')).failed, true);
});

test('Netflix background rejects foreign senders and stale episode commands', async () => {
  let listener: (m: unknown, s: unknown, respond: (r: { ok: boolean; error?: string }) => void) => boolean;
  let forwarded = 0;
  vm.runInNewContext(readFileSync(new URL('../extensions/netflix-companion/background.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, ''), {
    isLocalApp, watchId, validCommand,
    chrome: { runtime: { id: 'test-extension', onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } }, tabs: {
      get: async () => ({ id: 10, url: 'https://www.netflix.com/watch/456' }),
      sendMessage: async () => { forwarded++; return {}; },
    } },
  });
  const message = { source: 'listening-coach-local', command: { action: 'play', tabId: 10, watchId: '123' } };
  const sender = { id: 'test-extension', frameId: 0, tab: { id: 1 }, url: 'http://127.0.0.1:5173/netflix' };
  assert.equal(listener!(message, { ...sender, url: 'https://example.com' }, () => assert.fail('Foreign reply')), false);
  assert.equal(listener!(message, { ...sender, frameId: 1 }, () => assert.fail('Subframe reply')), false);
  const response = await new Promise<{ ok: boolean }>(resolve => listener(message, sender, resolve));
  assert.equal(response.ok, false); assert.equal(forwarded, 0);
});

test('Netflix reports unavailable seeking and disables the loop instead of faking success', async () => {
  const h = playerHarness();
  h.state.ignoreSeek = true; h.state.time = 50;
  const response = await h.send('range', { start: 10, end: 20, loop: true });
  assert.equal(response.failed, true);
  assert.equal((await h.send('status')).loop, false);
});

test('Netflix native control uses milliseconds and fails closed without the native API', async () => {
  const h = playerHarness();
  assert.equal((await h.send('seek', { time: 12.345 })).time, 12.345);
  assert.deepEqual(h.state.commands, [12345]);
  await h.send('pause'); assert.equal(h.video.paused, true);
  await h.send('play'); assert.equal(h.video.paused, false);
  h.state.available = false;
  assert.equal((await h.send('range', { start: 10, end: 20, loop: true })).failed, true);
  assert.deepEqual(h.state.commands, [12345]);
  h.state.available = true;
  assert.equal((await h.native({ action: 'seek', watchId: '456', time: 20 })).failed, true);
  assert.deepEqual(h.state.commands, [12345]);
});
