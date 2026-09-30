'use client';
import { useMemo, useRef, useState } from 'react';
import { ArrowUp, Repeat2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime } from '@/lib/youtube';
import { subtitleSelectionRange } from '@/lib/timed-subtitles';
import { groupSentenceCues, type SentenceCue } from '@/lib/sentence-cues';

const pageSize = 100;
type TranscriptCue = { start: number; end: number; text?: string };
type DisplaySentence = Omit<SentenceCue, 'text'> & { text?: string };
const cueKey = (cue: SentenceCue) => cue.key;

export function NetflixTranscript({ cues, preGrouped, offset, time, connected, playing, busy, start, end, selectedIndex, selectedSentenceIndex, onCue, onRange }: {
  cues: TranscriptCue[]; preGrouped?: DisplaySentence[]; offset: number; time: number; connected: boolean; playing?: boolean; busy: boolean; start: number; end: number;
  selectedIndex?: number; selectedSentenceIndex?: number; onCue?: (index: number, start: number, end: number, sentenceIndex: number) => void;
  onRange: (start: number, end: number, repeat: boolean) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set()), [page, setPage] = useState(Math.floor((selectedIndex ?? 0) / pageSize));
  const anchor = useRef<string | null>(null);
  const sentences = useMemo(() => preGrouped?.map(cue => ({...cue,text:cue.text ?? ''})) ?? groupSentenceCues(cues), [cues, preGrouped]);
  const selected = sentences.filter(c => checked.has(cueKey(c)));
  const range = subtitleSelectionRange(selected, offset);
  const pages = Math.max(1, Math.ceil(sentences.length / pageSize)), currentPage = Math.min(page, pages - 1);
  const occurrences = new Map<string, number>();
  const rows = sentences.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((cue,index) => {
    const key = cueKey(cue), occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { cue, index: currentPage * pageSize + index, rowKey: `${key}:${occurrence}` };
  });
  function toggle(cue: SentenceCue, shift: boolean) {
    const key = cueKey(cue), from = sentences.findIndex(c => cueKey(c) === anchor.current), to = sentences.indexOf(cue);
    setChecked(before => {
      const next = new Set(before), adding = !next.has(key);
      const items = shift && from >= 0 ? sentences.slice(Math.min(from, to), Math.max(from, to) + 1) : [cue];
      for (const item of items) { if (adding) next.add(cueKey(item)); else next.delete(cueKey(item)); }
      return next;
    });
    anchor.current = key;
  }
  return <details className="nf-all-transcript" open>
    <summary>Full Transcript <span>{sentences.length.toLocaleString()} sentences</span></summary>
    <div className="nf-transcript-tools">
      <div><strong>{selected.length ? `${selected.length} sentences selected` : 'Select sentences to repeat'}</strong><span>{range ? `${formatTime(range.start)} – ${formatTime(range.end)}` : 'Use the checkboxes to select multiple sentences.'}</span></div>
      <div className="nf-transcript-actions"><button disabled={!selected.length} onClick={() => { setChecked(new Set()); anchor.current = null; }}>Clear selection</button><button disabled={!range || busy} onClick={() => range && onRange(range.start, range.end, false)}><ArrowUp size={14}/>Set section</button><button className="nf-transcript-repeat" disabled={!range || !connected || busy} onClick={() => range && onRange(range.start, range.end, true)}><Repeat2 size={15}/>Repeat selection</button></div>
    </div>
    <p className="nf-transcript-hint">Playback includes everything from the first selected sentence to the last. Hold Shift to select a range. Sentence timing within a caption line is estimated.</p>
    <div className="nf-transcript-list" aria-label="Full transcript list">{rows.map(({ cue: c, index, rowKey }) => {
      const key = cueKey(c), isChecked = checked.has(key), isCurrent = connected && (playing ?? true) && c.start + offset <= time && time < c.end + offset;
      const inRange = c.start + offset < end && c.end + offset > start;
      const isPracticeSentence = index === selectedSentenceIndex;
      return <div className={`nf-transcript-row ${isChecked ? 'is-selected' : ''} ${isCurrent || isPracticeSentence ? 'is-current' : ''}`} key={rowKey}>
        <input type="checkbox" checked={isChecked} aria-label={`${formatTime(Math.max(0, c.start + offset))} ${c.text ?? 'Sentence hidden'}`} onChange={e => toggle(c, (e.nativeEvent as MouseEvent).shiftKey)}/>
        <span className="nf-transcript-time">{formatTime(Math.max(0, c.start + offset))}<span>{formatTime(Math.max(0, c.end + offset))}</span></span>
        {onCue ? <button className="nf-transcript-text" disabled={busy} onClick={() => {setChecked(new Set([key]));anchor.current=key;onCue(c.firstIndex,c.start+offset,c.end+offset,index);}}>{c.text || 'Sentence hidden · listen first'}<small className="nf-row-status">{isCurrent ? 'Playing now' : isPracticeSentence ? 'Current practice sentence' : inRange ? 'Selected section' : '\u00a0'}</small></button> : <span className="nf-transcript-text">{c.text}<small className="nf-row-status">{isCurrent ? 'Playing now' : inRange ? 'Selected section' : '\u00a0'}</small></span>}
      </div>;
    })}</div>
    <nav className="nf-transcript-pages" aria-label="Full transcript pages"><button aria-label="Previous transcript page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16}/></button><label>Page <select aria-label="Choose transcript page" value={currentPage} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: pages }, (_, i) => <option key={i} value={i}>{i + 1} / {pages}</option>)}</select></label><span>{sentences.length ? currentPage * pageSize + 1 : 0}–{Math.min(sentences.length, (currentPage + 1) * pageSize)} / {sentences.length}</span><button aria-label="Next transcript page" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16}/></button></nav>
  </details>;
}
