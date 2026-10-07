'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Captions, Upload, Eye, EyeOff, BookmarkPlus } from 'lucide-react';
import { formatTime, parseTranscript, type Cue } from '@/lib/youtube';
import { currentSubtitles } from '@/lib/timed-subtitles';
import { groupSentenceCues, type SentenceCue } from '@/lib/sentence-cues';
import { useNetflixCaptions } from './use-netflix-captions';

export type NetflixPracticeSource = { id: string; sentences: SentenceCue[] };

export function NetflixSubtitles({ watchId, title, liveSubtitle = '', time, connected, onNote, onPracticeSource }: {
  watchId: string; title: string; liveSubtitle?: string;
  time: number; connected: boolean; onNote: (text: string) => void;
  onPracticeSource: (source: NetflixPracticeSource) => void;
}) {
  const [cues, setCues] = useState<Cue[]>([]), [name, setName] = useState(''), [offset, setOffset] = useState(0);
  const [shown, setShown] = useState(true), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'recorded' | 'file'>('recorded');
  const [fileVersion, setFileVersion] = useState(0);
  const recording = useNetflixCaptions(watchId, title, time, liveSubtitle, connected);
  const input = useRef<HTMLInputElement>(null), generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function importFile(file?: File) {
    if (!file) return;
    const version = ++generation.current;
    setLoading(true); setError('');
    try {
      if (file.size > 1_500_000) throw Error('Choose a VTT/SRT file under 1.5 MB.');
      const parsed = parseTranscript(await file.text(), { maxCues: 5000, maxLength: 1_500_000, allowOverlap: true });
      if (version !== generation.current) return;
      setCues(parsed); setName(file.name); setOffset(0); setSource('file'); setFileVersion(v => v + 1);
    } catch (e) { if (version === generation.current) setError((e as Error).message); }
    finally { if (version === generation.current) setLoading(false); }
  }
  const active = useMemo(() => source === 'recorded' ? recording.track?.cues ?? [] : cues, [source, recording.track?.cues, cues]);
  const delay = source === 'file' ? offset : 0;
  const practiceSentences = useMemo(() => groupSentenceCues(active).map(sentence => ({ ...sentence, start: Math.max(0, sentence.start + delay), end: Math.max(0, sentence.end + delay) })), [active, delay]);
  const practiceSourceId = source === 'recorded' ? `recorded:${watchId}` : `file:${fileVersion}:${offset}`;
  useEffect(() => { onPracticeSource({ id: practiceSourceId, sentences: practiceSentences }); }, [onPracticeSource, practiceSourceId, practiceSentences]);
  const current = connected ? currentSubtitles(active, time, delay) : [];
  const currentText = source === 'recorded' && connected && liveSubtitle.trim() ? liveSubtitle : current.map(c => c.text).join('\n');
  return <section className="nf-subtitles" aria-label="Captions in the App">
    <div className="nf-subtitle-heading"><div><span className="nf-overline">YOUR TRANSCRIPT</span><h4><Captions size={20}/>Captions in the App</h4></div><button className="nf-caption-visibility" aria-pressed={shown} onClick={() => setShown(v => !v)}>{shown ? <EyeOff size={16}/> : <Eye size={16}/>} {shown ? 'Hide captions' : 'Show captions'}</button></div>
    <div className="nf-recording-state"><span className={`nf-recording-dot ${connected && !recording.error ? 'is-active' : ''}`}/><div><strong>{recording.error ? 'Check automatic saving' : !recording.loaded ? 'Loading saved captions…' : connected ? 'Recording captions automatically' : 'Waiting for video connection'}</strong><span>{recording.track?.cues.length ?? 0} captured · {recording.saving ? 'Saving…' : recording.track?.updatedAt ? 'Saved in this browser' : 'Turn on captions in Netflix and play the video.'}</span></div><span className="nf-recording-badge">{shown ? 'Captions visible' : 'Recording while hidden'}</span></div>
    {recording.error && <p role="alert" className="player-error">{recording.error} <button className="nf-caption-visibility" onClick={recording.retrySaving}>Try saving again</button></p>}
    <div className="nf-caption-sources" aria-label="Caption source"><button aria-pressed={source === 'recorded'} onClick={() => setSource('recorded')}>Recorded captions</button>{cues.length > 0 && <button aria-pressed={source === 'file'} onClick={() => setSource('file')}>Uploaded file</button>}<button disabled={loading} onClick={() => input.current?.click()}><Upload size={14}/>{loading ? 'Checking file…' : cues.length ? 'Change file' : 'Upload caption file'}</button></div>
    <input ref={input} type="file" accept=".vtt,.srt,text/vtt,text/plain" hidden aria-label="Netflix caption file" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }}/>
    {source === 'file' && <div className="nf-subtitle-file"><span title={name}>{name} · {cues.length.toLocaleString()} captions</span></div>}
    <div className="nf-caption-screen"><span className="nf-caption-timestamp">{formatTime(time)} · Current sentence</span><p>{!shown ? 'Captions are hidden. Recording and saving will continue.' : currentText}</p>{shown && currentText && <button className="nf-caption-note" onClick={() => onNote(`[${formatTime(time)}] ${currentText.replace(/\n/g, ' ')}`)}><BookmarkPlus size={16}/>Add sentence to notes</button>}</div>
    {source === 'file' && <div className="nf-caption-sync"><label>Caption timing <input aria-label="Caption timing adjustment in seconds" type="number" min={-600} max={600} step={.1} value={offset} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setOffset(Math.max(-600, Math.min(600, n))); }}/> sec</label><small>A positive value delays captions; a negative value shows them earlier.</small></div>}
    {error && <p role="alert" className="player-error">{error}</p>}
    <p className="nf-subtitle-help">Only captions shown in Netflix while connected are saved automatically for each title and episode. Reconnect from the same browser and app address to load them again. Saved sections remain available even when Netflix captions are off. Timing is based on screen detection and may vary slightly. Clearing site data also clears saved captions. Uploaded files are used only in this tab.</p>
  </section>;
}
