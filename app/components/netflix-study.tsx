'use client';
/* eslint-disable @next/next/no-html-link-for-pages */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, Save, Tv } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NetflixSubtitles, type NetflixPracticeSource } from './netflix-subtitles';
import { YouTubePractice } from './youtube-practice';
import { useMediaPracticeTime } from './use-media-practice-time';
import { score } from '@/lib/core';
import { formatTime, validRange, type VideoAttempt } from '@/lib/youtube';
import type { NetflixClip, NetflixTab, NetflixStatus } from '@/lib/netflix';
import './netflix-study.css';

type ExtensionResponse = { version?: string; tabs?: NetflixTab[] } & Partial<NetflixStatus>;
type SavedClipsResponse = { clips: NetflixClip[]; error?: string };
const supportedExtensionVersions = ['0.2.0', '0.2.1', '0.2.2'];

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
    const timer = setTimeout(() => { finish(); reject(Error('The extension is not responding. Install or update to 0.2.2 in Chrome, then refresh the extension, Netflix and this page.')); }, 4000);
    window.addEventListener('message', reply);
    window.postMessage({ source: 'listening-coach-page', id, command }, window.location.origin);
  });
}

export function NetflixStudy() {
  const [installed, setInstalled] = useState(false), [tabs, setTabs] = useState<NetflixTab[]>([]), [target, setTarget] = useState<NetflixTab | null>(null);
  const [status, setStatus] = useState<NetflixStatus | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [start, setStart] = useState(0), [end, setEnd] = useState(30), [notes, setNotes] = useState(''), [title, setTitle] = useState('');
  const [clips, setClips] = useState<NetflixClip[]>([]), [auth, setAuth] = useState(true), [tab, setTab] = useState('practice');
  const [practiceSource, setPracticeSource] = useState<NetflixPracticeSource>({ id: '', sentences: [] });
  const [selectedSentences, setSelectedSentences] = useState<number[]>([]), [markedSentences, setMarkedSentences] = useState<number[]>([]), [focusedSentence, setFocusedSentence] = useState(0);
  const [answer, setAnswer] = useState(''), [usedCaptions, setUsedCaptions] = useState(false), [attempt, setAttempt] = useState<VideoAttempt>();
  const dirty = useRef(false), pending = useRef(false), initializedSource = useRef(''), captionPanel = useRef<HTMLDivElement>(null);
  const [extensionVersion, setExtensionVersion] = useState('');
  const sentences = practiceSource.sentences;
  const chosenSentences = selectedSentences.filter(index => !!sentences[index]);
  const practiceStart = sentences[chosenSentences[0]]?.start ?? start;
  const practiceEnd = sentences[chosenSentences.at(-1) ?? -1]?.end ?? end;
  const practiceText = chosenSentences.map(index => sentences[index]?.text).filter(Boolean).join(' ');
  const firstSentence = chosenSentences[0] ?? -1, lastSentence = chosenSentences.at(-1) ?? -1;
  const consecutiveSentences = chosenSentences.every((index, position) => position === 0 || index === chosenSentences[position - 1] + 1);
  const practiceLabel = chosenSentences.length ? consecutiveSentences ? `Sentence${chosenSentences.length > 1 ? 's' : ''} ${firstSentence + 1}${chosenSentences.length > 1 ? `–${lastSentence + 1}` : ''} of ${sentences.length}` : `${chosenSentences.length} selected sentences of ${sentences.length}` : `Sentence 0 of ${sentences.length}`;
  const updatePracticeSource = useCallback((source: NetflixPracticeSource) => setPracticeSource(source), []);
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const info = await extension({ action: 'ping' });
      if (!supportedExtensionVersions.includes(info.version ?? '')) { setTarget(null); setTabs([]); throw Error('Update to extension 0.2.2. Download the ZIP below, replace the files in the existing extension folder, refresh it at chrome://extensions, then refresh Netflix and the app.'); }
      setInstalled(true); setExtensionVersion(info.version ?? '');
      const data = await extension({ action: 'list' }); setTabs(data.tabs ?? []);
      setMessage(data.tabs?.length ? `Extension ${info.version} connected. Choose a video below.` : 'Open a Netflix title or play an episode, then check again.');
    } catch (e) { setInstalled(false); setError((e as Error).message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/netflix').then(async response => { if (response.status === 401) { if (live) setAuth(false); return; } const data = await response.json() as SavedClipsResponse; if (!response.ok) throw Error(data.error); if (live) setClips(data.clips); }).catch(e => { if (live) setError(e.message); });
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
  useEffect(() => {
    if (!sentences.length || initializedSource.current === practiceSource.id) return;
    initializedSource.current = practiceSource.id;
    const currentTime = status?.time ?? 0;
    const current = sentences.findIndex(sentence => sentence.start <= currentTime && currentTime < sentence.end);
    const previous = sentences.findLastIndex(sentence => sentence.start <= currentTime);
    const index = current >= 0 ? current : Math.max(0, previous);
    const sentence = sentences[index];
    setFocusedSentence(index); setSelectedSentences([index]); setMarkedSentences([index]);
    setStart(sentence.start); setEnd(sentence.end); setAnswer(''); setUsedCaptions(false); setAttempt(undefined);
  }, [practiceSource.id, sentences, status?.time]);

  async function command(action: string, extra: Record<string, unknown> = {}) {
    if (!target || pending.current) return false;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const info = await extension({ action: 'ping' });
      if (!supportedExtensionVersions.includes(info.version ?? '')) throw Error('Playback commands for the old extension were stopped. Update to 0.2.2, then refresh Netflix and the app.');
      const data = await extension({ action, ...target, ...extra }); setStatus(data as NetflixStatus); return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  function resetAnswer() { setAnswer(''); setUsedCaptions(false); setAttempt(undefined); }
  function selectSentence(index: number) {
    const sentence = sentences[index]; if (!sentence) return;
    setFocusedSentence(index); setSelectedSentences([index]); setStart(sentence.start); setEnd(sentence.end); resetAnswer();
    const loop = !!status?.loop;
    void (async () => {
      const applied = await command('range', { start: sentence.start, end: sentence.end, loop });
      if (applied && !loop) await command('seek', { time: sentence.start });
    })();
  }
  function toggleMarkedSentence(index: number) {
    if (!sentences[index]) return;
    setMarkedSentences(before => before.includes(index) ? before.filter(value => value !== index) : [...before, index].sort((a, b) => a - b));
  }
  async function selectPracticeRange(from: number, to: number, repeat: boolean, selectedIndexes?: number[]) {
    const indexes = selectedIndexes?.length
      ? [...new Set(selectedIndexes)].filter(index => !!sentences[index]).sort((a, b) => a - b)
      : sentences.map((sentence, index) => ({ sentence, index })).filter(({ sentence }) => sentence.start < to && sentence.end > from).map(({ index }) => index);
    if (!indexes.length) return;
    setSelectedSentences(indexes); setMarkedSentences(indexes); setFocusedSentence(indexes[0]); setStart(from); setEnd(to); resetAnswer();
    const applied = await command('range', { start: from, end: to, loop: repeat });
    if (!applied) return;
    if (repeat) setMessage('Repeating the selected caption section.');
    else if (await command('seek', { time: from })) setMessage(`${formatTime(from)} – ${formatTime(to)} selected.`);
  }
  function rangeValid() {
    if (!validRange(practiceStart, practiceEnd) || !status?.duration || practiceEnd > status.duration) { setError('Set the start and end within the video length.'); return false; }
    return true;
  }
  async function apply(loop: boolean) {
    if (!loop && status?.loop) { if (await command('range', { start: status.start, end: status.end, loop: false })) setMessage('Repeat is off. Playback will continue past the section end.'); return; }
    if (rangeValid() && await command('range', { start: practiceStart, end: practiceEnd, loop })) setMessage('Repeat section applied. Press Play to loop it.');
  }
  async function playPause() {
    if (status?.paused !== false) {
      const time = status?.time ?? 0;
      const beforeSelection = time < practiceStart;
      const finishedRepeatedSelection = !!status?.loop && time >= practiceEnd - .08;
      if ((beforeSelection || finishedRepeatedSelection) && !await command('seek', { time: practiceStart })) return;
      await command('play');
    } else await command('pause');
  }
  async function replay() {
    if (!await command('seek', { time: practiceStart })) return;
    if (status?.paused !== false) await command('play');
  }
  async function rewind(seconds: number) {
    const destination = Math.max(practiceStart, (status?.time ?? practiceStart) - seconds);
    await command('seek', { time: destination });
  }
  function submitAnswer() {
    if (!answer.trim() || !practiceText) return;
    void command('pause');
    setAttempt({ answer, accuracy: score(answer, practiceText), captions: usedCaptions, createdAt: new Date().toISOString(), sentenceIndexes: chosenSentences });
  }
  async function save() {
    if (!target || !validRange(practiceStart, practiceEnd) || !title.trim() || pending.current) { setError('Check the connected video title and section.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/netflix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchId: target.watchId, title, start: practiceStart, end: practiceEnd, notes }) });
      const data = await response.json() as SavedClipsResponse; if (!response.ok) throw Error(data.error); setClips(data.clips); dirty.current = false; setMessage('Section and notes saved.');
    } catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  function chooseVideo(video: NetflixTab) {
    if (dirty.current && !window.confirm('Discard unsaved notes and switch videos?')) return;
    dirty.current = false; initializedSource.current = ''; setPracticeSource({ id: '', sentences: [] });
    setTarget(video); setStatus(null); setTitle(video.title); setStart(0); setEnd(30); setNotes(''); setMessage('Connecting…');
    setSelectedSentences([]); setMarkedSentences([]); resetAnswer(); setTab('practice');
  }
  function loadClip(clip: NetflixClip) {
    if (dirty.current && !window.confirm('Replace your unsaved notes?')) return;
    const indexes = sentences.map((sentence, index) => ({ sentence, index })).filter(({ sentence }) => sentence.start < clip.end && sentence.end > clip.start).map(({ index }) => index);
    setStart(clip.start); setEnd(clip.end); setTitle(clip.title); setNotes(clip.notes); dirty.current = false; resetAnswer();
    if (indexes.length) { setSelectedSentences(indexes); setMarkedSentences(indexes); setFocusedSentence(indexes[0]); }
    setTab('practice'); setMessage('Saved section loaded. Turn on Repeat when you are ready.');
  }
  const playerStatus = { ready: !!status?.ready, playing: status?.paused === false, time: status?.time ?? 0, duration: status?.duration ?? 0 };
  useMediaPracticeTime('netflix', !!target && !!status?.ready && !status.paused);
  return <div className="youtube-study netflix-study">
    <div className="youtube-toolbar"><div><span className="eyebrow">NETFLIX LISTENING</span><h2>Practice Listening with Netflix</h2></div><a className="secondary" href="https://www.netflix.com/login" target="_blank" rel="noreferrer">Open Netflix<ExternalLink size={16}/></a></div>
    <div className="video-main">
      <section className="panel video-main-panel netflix-connect netflix-player-panel">
        <div className="video-title"><span className="eyebrow"><Tv size={18}/> ORIGINAL AUDIO · NETFLIX</span><h2>{target?.title ?? 'Connect a Netflix video'}</h2><p>Choose a caption, shadow the line aloud, and repeat difficult sections at your pace.</p></div>
        <div className="button-row"><a className="primary" href="https://www.netflix.com/login" target="_blank" rel="noreferrer">Open Netflix / Sign in<ExternalLink size={16}/></a><button className="secondary" disabled={busy} onClick={refresh}><Link2 size={16}/>{installed ? 'Refresh video list' : 'Check extension connection'}</button></div>
        <details open={!installed}><summary>Install extension / Update to 0.2.2</summary><p>Version 0.2.2 connects from localhost or 127.0.0.1 on any local port. If the extension is already installed, replace its files with the ZIP below, refresh it on the extension management page, then refresh Netflix and the learning app.</p><ol>
          <li>Open this learning app in regular Chrome at its local address, such as <code>http://localhost:3000/netflix</code>.</li>
          <li><a href="/downloads/listening-coach-netflix.zip" download>Download connection extension</a>, then unzip the file.</li>
          <li>Enter <code>chrome://extensions</code> in the address bar, turn on Developer mode, and choose Load unpacked to select the extracted folder.</li>
          <li>Refresh this app and Netflix, sign in to Netflix, and play a title. Then use Check extension connection to choose the video.</li>
        </ol><small>Sign in only on the official Netflix page. Netflix keeps the session; use Chrome password management if you want to save the password.</small></details>
        {installed && extensionVersion !== '0.2.2' && <p className="player-help">Extension 0.2.2 adds support for other local ports. Download the ZIP above, update the extension, and refresh Netflix and the app.</p>}
        {installed && <div className="netflix-tab-list">{tabs.map(video => <button className={target?.tabId === video.tabId ? 'secondary active' : 'secondary'} key={video.tabId} disabled={busy} onClick={() => chooseVideo(video)}>{video.title} · Tab {video.tabId}</button>)}</div>}
        {target ? <div className="netflix-video-status"><div><span>NETFLIX VIDEO</span><strong>{target.title}</strong><small>{status?.ready ? 'Connected to Netflix playback' : 'Waiting for Netflix playback'}</small></div><button className="secondary" disabled={busy} onClick={() => { setTarget(null); setStatus(null); setPracticeSource({ id: '', sentences: [] }); setMessage('Disconnected.'); }}>Disconnect</button></div> : <p role="status" className="muted">{message || 'Install the extension, then check the connection.'}</p>}
        {error && <p role="alert" className="player-error">{error}</p>}
      </section>
      {!auth && <p className="panel netflix-connect">To save notes, <a href="/signin-with-chatgpt?return_to=/netflix">open your local learning space.</a> This is separate from your Netflix sign-in.</p>}
      {target && <section className="panel video-practice netflix-learning-panel">
        <Tabs value={tab} onValueChange={setTab}><TabsList className="video-tabs"><TabsTrigger value="practice">Practice</TabsTrigger><TabsTrigger value="notes">My Notes</TabsTrigger></TabsList>
          <TabsContent value="practice">
            <YouTubePractice shadowingOnly status={playerStatus} start={practiceStart} end={practiceEnd} loop={!!status?.loop} busy={busy} count={chosenSentences.length} label={practiceLabel} answer={answer} captions={usedCaptions} attempt={attempt} transcript={practiceText} sentences={sentences} selectedSentenceIndexes={chosenSentences} checkedSentences={markedSentences} hasPrevious={focusedSentence > 0} hasNext={focusedSentence < sentences.length - 1} onPlay={() => void playPause()} onReplay={() => void replay()} onRewind={seconds => void rewind(seconds)} onLoop={next => void apply(next)} onAnswer={setAnswer} onCaptions={setUsedCaptions} onSubmit={submitAnswer} onPrevious={() => selectSentence(focusedSentence - 1)} onNext={() => selectSentence(focusedSentence + 1)} onSelectRange={(from, to, repeat, indexes) => void selectPracticeRange(from, to, repeat, indexes)} onSelectSentence={selectSentence} onToggleSentence={toggleMarkedSentence} onClearSentences={() => setMarkedSentences([])} onImport={() => captionPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} onNotes={() => setTab('notes')} emptyTitle="Capture subtitles to start shadowing." emptyBody="Turn on Netflix captions and play the video, or upload a VTT/SRT file below. Captured sentences will appear here automatically." emptyActionLabel="Open caption tools"/>
            <div ref={captionPanel} className="netflix-caption-tools"><NetflixSubtitles key={target.watchId} watchId={target.watchId} title={target.title} liveSubtitle={status?.subtitle} time={status?.time ?? 0} connected={!!status?.ready && status.watchId === target.watchId} onPracticeSource={updatePracticeSource} onNote={text => { setNotes(value => (value + '\n' + text).trim().slice(0, 20000)); dirty.current = true; setMessage('Sentence added to notes.'); }}/></div>
          </TabsContent>
          <TabsContent value="notes"><div className="panel-heading"><div><span className="nf-overline">STUDY NOTES</span><h3>Lines to hear again and expressions to remember</h3></div></div><label className="netflix-title">Title to save<input value={title} maxLength={200} onChange={event => { setTitle(event.target.value); dirty.current = true; }}/></label><textarea className="video-notes" aria-label="Netflix practice notes" value={notes} maxLength={20000} onChange={event => { setNotes(event.target.value); dirty.current = true; }} placeholder="Write what you heard or expressions you want to remember."/><div className="button-row"><button className="primary" disabled={busy || !auth} onClick={save}><Save size={17}/>Save section and notes</button><button className="secondary" disabled={!status?.subtitle || busy} onClick={() => { setNotes(value => (value + `\n[${formatTime(status!.time)}] ${status!.subtitle}`).trim().slice(0, 20000)); dirty.current = true; }}>Add current caption to notes</button></div><small className="muted">The currently selected Practice section is saved with these notes.</small></TabsContent>
        </Tabs>
        {message && <p role="status" className="netflix-practice-message">{message}</p>}
      </section>}
      <section className="panel netflix-connect netflix-saved"><h3>Saved Netflix Sections <span className="muted">{clips.length}</span></h3>{clips.length === 0 ? <p className="muted">Saved sections and notes from connected videos appear here.</p> : clips.map(clip => <article className="netflix-clip" key={clip.id}><h4>{clip.title}</h4><p>{formatTime(clip.start)}–{formatTime(clip.end)}</p><p className="netflix-note">{clip.notes}</p><div className="button-row"><a className="text-button" href={`https://www.netflix.com/watch/${clip.watchId}`} target="_blank" rel="noreferrer">Open in Netflix<ExternalLink size={14}/></a><button className="secondary" disabled={busy || target?.watchId !== clip.watchId} onClick={() => loadClip(clip)}>Load section</button></div></article>)}</section>
    </div>
  </div>;
}
