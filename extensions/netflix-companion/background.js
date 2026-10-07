import { isLocalApp, watchId, validCommand } from './protocol.js';
import { netflixControl } from './player-control.js';

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || message?.source !== 'listening-coach-native') return false;
  const c = message.command;
  if (!watchId(sender.url) || watchId(sender.url) !== c?.watchId || !['status', 'seek', 'play', 'pause'].includes(c.action)) return false;
  if (c.action === 'seek' && (!Number.isFinite(c.time) || c.time < 0 || c.time > 86400)) return false;
  chrome.scripting.executeScript({ target: { tabId: sender.tab.id, frameIds: [0] }, world: 'MAIN', func: netflixControl, args: [{ action: c.action, watchId: c.watchId, ...(c.action === 'seek' ? { time: c.time } : {}) }] })
    .then(results => respond(results[0]?.result ?? { failed: true, error: 'The Netflix player did not respond.' }), () => respond({ failed: true, error: 'Update the extension to 0.2.2 and refresh both tabs.' }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || !isLocalApp(sender.url) || message?.source !== 'listening-coach-local') return false;
  async function dispatch() {
    const command = message.command;
    if (!validCommand(command)) throw Error('Invalid playback command.');
    if (command.action === 'ping') return { version: '0.2.2' };
    if (command.action === 'list') {
      const tabs = await chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' });
      return { tabs: tabs.filter(t => watchId(t.url)).map(t => ({ tabId: t.id, watchId: watchId(t.url), title: (t.title || 'Netflix').slice(0, 200) })) };
    }
    const tab = await chrome.tabs.get(command.tabId);
    if (watchId(tab.url) !== command.watchId) throw Error('The video changed. Choose the video again.');
    return chrome.tabs.sendMessage(command.tabId, { source: 'listening-coach-controller', owner: sender.tab.id, command });
  }
  dispatch().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message || 'Install the extension, then refresh the Netflix tab.' }));
  return true;
});
