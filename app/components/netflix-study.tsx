'use client';
/* eslint-disable @next/next/no-html-link-for-pages */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, Save, Tv } from 'lucide-react';
import { NetflixRangeControls } from './netflix-range-controls';
import { NetflixSubtitles } from './netflix-subtitles';
import { useMediaPracticeTime } from './use-media-practice-time';
import { formatTime, validRange } from '@/lib/youtube';
import type { NetflixClip, NetflixTab, NetflixStatus } from '@/lib/netflix';
import './netflix-study.css';

type ExtensionResponse = { version?: string; tabs?: NetflixTab[] } & Partial<NetflixStatus>;
type SavedClipsResponse = { clips: NetflixClip[]; error?: string };
function extension(command: Record<string, unknown>): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const finish = () => { clearTimeout(timer); window.removeEventListener('message', reply); };
    const reply = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== 'listening-coach-extension' || event.data.id !== id) return;
      finish();
      if (!event.data.ok || event.data.data?.failed) reject(Error(event.data.error || event.data.data?.error || 'Check the connection.'));
      else resolve(event.data.data);
    };
    const timer = setTimeout(() => { finish(); reject(Error('The extension is not responding. Install it in Chrome and refresh both tabs.')); }, 4000);
    window.addEventListener('message', reply);
    window.postMessage({ source: 'listening-coach-page', id, command }, window.location.origin);
  });
}
export function NetflixStudy() {
  const [installed, setInstalled] = useState(false), [tabs, setTabs] = useState<NetflixTab[]>([]), [target, setTarget] = useState<NetflixTab | null>(null);
  const [status, setStatus] = useState<NetflixStatus | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [start, setStart] = useState(0), [end, setEnd] = useState(30), [notes, setNotes] = useState(''), [title, setTitle] = useState('');
  const [clips, setClips] = useState<NetflixClip[]>([]), [auth, setAuth] = useState(true);
  const dirty = useRef(false), pending = useRef(false);
  const [extensionVersion, setExtensionVersion] = useState('');
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try { const info = await extension({ action: 'ping' }); if (!['0.2.0', '0.2.1'].includes(info.version ?? '')) { setTarget(null); setTabs([]); throw Error('Extension 0.2.1 is required. Download the ZIP below, replace the files in the existing extension folder, refresh it at chrome://extensions, then refresh Netflix and the app.'); } setInstalled(true); setExtensionVersion(info.version ?? ''); const data = await extension({ action: 'list' }); setTabs(data.tabs ?? []); setMessage(data.tabs?.length ? `Extension ${info.version} connected. Choose a video below.` : 'Open a Netflix title or play an episode, then check again.'); }
    catch (e) { setInstalled(false); setError((e as Error).message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/netflix').then(async r => { if (r.status === 401) { if (live) setAuth(false); return; } const data = await r.json() as SavedClipsResponse; if (!r.ok) throw Error(data.error); if (live) setClips(data.clips); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    const leave = (event: Event) => { if (dirty.current && !window.confirm('You have unsaved Netflix notes. Leave this page?')) event.preventDefault(); };
    window.addEventListener('beforeunload', warn); window.addEventListener('coach-before-navigate', leave);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('coach-before-navigate', leave); };
  }, []);
  useEffect(() => {
    if (!target) return;
    let live = true, polling = false;
    async function poll() {
      if (polling) return; polling = true;
      try { const data = await extension({ action: 'status', ...target }); if (live) { setStatus(data as NetflixStatus); setError(data.error ?? ''); } }
      catch (e) { if (live) { setStatus(null); setError((e as Error).message); } }
      finally { polling = false; }
    }
    void poll(); const timer = setInterval(poll, 500);
    return () => { live = false; clearInterval(timer); void extension({ action: 'disconnect', ...target }).catch(() => {}); };
  }, [target]);
  async function command(action: string, extra: Record<string, unknown> = {}) {
    if (!target || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try { const info = await extension({ action: 'ping' }); if (!['0.2.0', '0.2.1'].includes(info.version ?? '')) throw Error('Playback commands for the old extension were stopped. Update to 0.2.1, then refresh Netflix and the app.'); const data = await extension({ action, ...target, ...extra }); setStatus(data as NetflixStatus); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  async function capture(edge: 'start' | 'end') {
    if (!target || pending.current) return;
    pending.current = true; setBusy(true);
    try { const data = await extension({ action: 'status', ...target }) as NetflixStatus; if (!data.ready || !Number.isFinite(data.time)) throw Error('Play the Netflix title first.'); setStatus(data); (edge === 'start' ? setStart : setEnd)(Math.round(data.time * 1000) / 1000); setMessage(`${edge === 'start' ? 'Start' : 'End'} set to ${formatTime(data.time)}.`); }
    catch (e) { setError((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  function rangeValid() {
    if (!validRange(start, end) || !status?.duration || end > status.duration) { setError('Set the start and end within the video length.'); return false; }
    return true;
  }
  async function apply(loop: boolean) {
    if (!loop && status?.loop) { if (await command('range', { start: status.start, end: status.end, loop: false })) setMessage('Repeat is off. Playback will continue past the section end.'); return; }
    if (rangeValid() && await command('range', { start, end, loop })) setMessage('Repeat section applied. Press Play to loop it.');
  }
  async function selectSubtitleRange(from: number, to: number, repeat: boolean) {
    if (pending.current) return;
    if (!validRange(from, to) || (status?.duration && to > status.duration)) { setError('The selected caption timing is outside the video. Check the caption timing adjustment.'); return; }
    setStart(from); setEnd(to); setError('');
    if (!repeat) { setMessage(`${formatTime(from)} – ${formatTime(to)} selected. Choose “Repeat this section” to apply it.`); return; }
    if (await command('range', { start: from, end: to, loop: true })) {
      if (status?.paused && !await command('play')) return;
      setMessage('Repeating the selected caption section.');
    }
  }
  async function save() {
    if (!target || !validRange(start, end) || !title.trim() || pending.current) { setError('Check the connected video title and section.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const r = await fetch('/api/netflix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchId: target.watchId, title, start, end, notes }) });
      const data = await r.json() as SavedClipsResponse; if (!r.ok) throw Error(data.error); setClips(data.clips); dirty.current = false; setMessage('Section and notes saved.');
    } catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  const ready = !!status?.ready && !busy;
  useMediaPracticeTime('netflix',!!target&&!!status?.ready&&!status.paused);
  return <div className="netflix-study">
    <section className="panel netflix-connect">
      <span className="eyebrow"><Tv size={18}/> NETFLIX LISTENING · CHROME</span>
      <h2>Practice Listening with Stories You Love</h2>
      <p>Play Netflix in its official tab, then choose and repeat sections in this practice space.</p>
      <div className="button-row"><a className="primary" href="https://www.netflix.com/login" target="_blank" rel="noreferrer">Open Netflix / Sign in<ExternalLink size={16}/></a><button className="secondary" disabled={busy} onClick={refresh}><Link2 size={16}/>{installed ? 'Refresh video list' : 'Check extension connection'}</button></div>
      <details open={!installed}><summary>Install extension / Update to 0.2.1</summary><p>Version 0.2.1 fixes words joining when caption line breaks disappear. If the extension is already installed, replace its files with the ZIP below, refresh it on the extension management page, then refresh Netflix and the learning app.</p><ol>
        <li>Open this learning app in regular Chrome at <code>http://127.0.0.1:5173/netflix</code>.</li>
        <li><a href="/downloads/listening-coach-netflix.zip" download>Download connection extension</a>, then unzip the file.</li>
        <li>Enter <code>chrome://extensions</code> in the address bar, turn on Developer mode, and choose Load unpacked to select the extracted folder.</li>
        <li>Refresh this app and Netflix, sign in to Netflix, and play a title. Then use Check extension connection to choose the video.</li>
      </ol><small>Sign in only on the official Netflix page. Netflix keeps the session; use Chrome password management if you want to save the password.</small></details>
      {installed && extensionVersion === '0.2.0' && <p className="player-help">Caption line-break fix 0.2.1 is available. Download the ZIP below, update the extension, and refresh Netflix and the app.</p>}
      {installed && <div className="netflix-tab-list">{tabs.map(t => <button className={target?.tabId === t.tabId ? 'secondary active' : 'secondary'} key={t.tabId} disabled={busy} onClick={() => { if (dirty.current && !window.confirm('Discard unsaved notes and switch videos?')) return; dirty.current = false; setTarget(t); setStatus(null); setTitle(t.title); setStart(0); setEnd(30); setNotes(''); setMessage('Connecting…'); }}>{t.title} · Tab {t.tabId}</button>)}</div>}
      {target ? <div className="netflix-video-status"><div><span>NETFLIX VIDEO</span><strong>{target.title}</strong><small>{status?.ready ? 'Connected to Netflix playback' : 'Waiting for Netflix playback'}</small></div><button className="secondary" disabled={busy} onClick={() => { setTarget(null); setStatus(null); setMessage('Disconnected.'); }}>Disconnect</button></div> : <p role="status" className="muted">{message || 'Install the extension, then check the connection.'}</p>}
      {error && <p role="alert" className="player-error">{error}</p>}
    </section>
    {!auth && <p className="panel netflix-connect">To save notes, <a href="/signin-with-chatgpt?return_to=/netflix">open your local learning space.</a> This is separate from your Netflix sign-in.</p>}
    {target && <>
    <section className="panel netflix-connect netflix-caption-stage">
      <NetflixSubtitles key={target.watchId} watchId={target.watchId} title={target.title} liveSubtitle={status?.subtitle} time={status?.time ?? 0} connected={!!status?.ready && status.watchId === target.watchId} start={start} end={end} busy={busy} onRange={selectSubtitleRange} onNote={text => { setNotes(n => (n + '\n' + text).trim().slice(0, 20000)); dirty.current = true; setMessage('Sentence added to notes. Use the save button below to keep it.'); }}/>
    </section>
    <section className="panel netflix-connect netflix-practice-stage">
      <div className="panel-heading"><div><span className="nf-overline">STUDY</span><h3>Study Section</h3></div><small>Organize what you heard and the expressions from the selected section.</small></div>
      <label className="netflix-title">Title to save<input value={title} maxLength={200} onChange={e => { setTitle(e.target.value); dirty.current = true; }}/></label>
      <textarea className="video-notes" aria-label="Netflix practice notes" value={notes} maxLength={20000} onChange={e => { setNotes(e.target.value); dirty.current = true; }} placeholder="Write what you heard or expressions you want to remember."/>
      <div className="button-row"><button className="primary" disabled={busy || !auth} onClick={save}><Save size={17}/>Save section and notes</button><button className="secondary" disabled={!status?.subtitle || busy} onClick={() => { setNotes(n => (n + `\n[${formatTime(status!.time)}] ${status!.subtitle}`).trim().slice(0, 20000)); dirty.current = true; }}>Add current caption to notes</button></div>
      <p className="player-help">Captions are saved automatically in the transcript section above. Use this button when you also want the current sentence in your study notes.</p>
    </section>
    <section className="panel netflix-connect netflix-range-stage">
      <NetflixRangeControls status={status} start={start} end={end} disabled={!ready} onStart={setStart} onEnd={setEnd} onCapture={capture} onPlayPause={() => command(status?.paused ? 'play' : 'pause')} onReplay={() => command('seek', { time: start })} onApply={apply}/>
      {message && <p role="status">{message}</p>}
    </section>
    </>}
    <section className="panel netflix-connect"><h3>Saved Netflix Sections <span className="muted">{clips.length}</span></h3>{clips.length === 0 ? <p className="muted">Saved sections and notes from connected videos appear here.</p> : clips.map(c => <article className="netflix-clip" key={c.id}><h4>{c.title}</h4><p>{formatTime(c.start)}–{formatTime(c.end)}</p><p className="netflix-note">{c.notes}</p><div className="button-row"><a className="text-button" href={`https://www.netflix.com/watch/${c.watchId}`} target="_blank" rel="noreferrer">Open in Netflix<ExternalLink size={14}/></a><button className="secondary" disabled={busy || target?.watchId !== c.watchId} onClick={() => { if (dirty.current && !window.confirm('Replace your unsaved notes?')) return; setStart(c.start); setEnd(c.end); setTitle(c.title); setNotes(c.notes); dirty.current = false; setMessage('Saved section loaded. Apply it to start repeating.'); }}>Load section</button></div></article>)}</section>
  </div>;
}
