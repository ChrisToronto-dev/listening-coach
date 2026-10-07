'use client';
import { useRef } from 'react';
import { Play, Pause, RotateCcw, Repeat2, Check, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTime, type VideoAttempt, type VideoView } from '@/lib/youtube';
import type { YouTubePlayerStatus } from './youtube-player';
import './youtube-practice.css';

type Props = {
  status: YouTubePlayerStatus; start: number; end: number; loop: boolean; busy: boolean;
  count: number; label: string; answer: string; captions: boolean; attempt?: VideoAttempt;
  transcript: string; hasPrevious: boolean; hasNext: boolean;
  sentences: VideoView['transcriptCues']; selectedSentenceIndexes: number[]; checkedSentences: number[];
  onPlay: () => void; onReplay: () => void; onRewind: (seconds: number) => void; onLoop: (next: boolean) => void;
  onAnswer: (text: string) => void; onCaptions: (next: boolean) => void;
  onSubmit: () => void; onPrevious: () => void; onNext: () => void;
  onSelectRange: (start: number, end: number, repeat: boolean) => void;
  onSelectSentence: (index: number) => void; onToggleSentence: (index: number) => void; onClearSentences: () => void;
  onImport: () => void; onNotes: () => void;
  attemptStateLabel?: string; submitHelp?: string; feedbackHelp?: string;
  emptyTitle?: string; emptyBody?: string; emptyActionLabel?: string;
};

function sectionTime(seconds: number) {
  return `${formatTime(seconds)}.${String(Math.floor((seconds % 1) * 10))}`;
}

function sectionDuration(start: number, end: number) {
  const duration = Math.max(0, end - start);
  return `${duration.toFixed(duration < 1 ? 2 : 1)} sec`;
}

export function YouTubePractice(props: Props) {
  const { status, start, end, loop, busy, count, label, answer, captions, attempt, transcript } = props;
  const form = useRef<HTMLFormElement>(null);
  const sentenceList = useRef<HTMLDivElement>(null);
  const checked = props.checkedSentences;
  function centerCurrentSentence() {
    const list = sentenceList.current;
    const current = list?.querySelector<HTMLElement>('[data-current-sentence="true"]');
    if (list && current) list.scrollTop += current.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientHeight / 2;
  }
  const firstChecked = checked.length ? Math.min(...checked) : -1;
  const lastChecked = checked.length ? Math.max(...checked) : -1;
  const rangeCount = lastChecked - firstChecked + 1;
  const rangeStart = props.sentences[firstChecked]?.start;
  const rangeEnd = props.sentences[lastChecked]?.end;
  const canUseChecked = !busy && rangeCount >= 1 && rangeCount <= 100 && rangeStart !== undefined && rangeEnd !== undefined;
  function useChecked() {
    if (canUseChecked) props.onSelectRange(rangeStart!, rangeEnd!, loop);
  }
  const canSubmit = count > 0 && !attempt && !busy && !!answer.trim();
  const playback = <div className="yt-practice-transport" role="group" aria-label="Practice playback">
    <div className="yt-play-buttons">
      <button className="primary" disabled={!status.ready || busy} onClick={props.onPlay}>{status.playing ? <Pause size={18}/> : <Play size={18}/>} {status.playing ? 'Pause' : 'Play'}</button>
      <button className="secondary" disabled={!status.ready || busy} onClick={props.onReplay} aria-keyshortcuts="Alt+R" title="Play from start (Alt/Option + R)"><RotateCcw size={17}/>Play from start</button>
      <button className="secondary yt-rewind" disabled={!status.ready || busy} onClick={() => props.onRewind(3)} title="Go back 3 seconds" aria-label="Go back 3 seconds">−3s</button>
      <button className="secondary yt-rewind" disabled={!status.ready || busy} onClick={() => props.onRewind(5)} title="Go back 5 seconds" aria-label="Go back 5 seconds">−5s</button>
      <button className="yt-repeat" role="switch" aria-label="Repeat selection" aria-checked={loop} disabled={!status.ready || busy || !count} onClick={() => props.onLoop(!loop)}><Repeat2 size={17}/>Repeat <strong>{loop ? 'On' : 'Off'}</strong></button>
    </div>
    <div className="yt-playback-info"><span>{count ? `${sectionTime(start)} – ${sectionTime(end)} · ${sectionDuration(start, end)}` : 'Full video'}</span><small>{!status.ready ? 'Waiting for player' : loop ? 'Repeating your selection' : 'Repeat off · playback continues'}</small></div>
  </div>;
  return <div className="yt-practice" onKeyDown={event => {
    if (event.nativeEvent.isComposing) return;
    if (event.altKey && event.code === 'KeyR') {
      event.preventDefault();
      if (status.ready && !busy) props.onReplay();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (canSubmit) form.current?.requestSubmit();
    }
  }}>
    <div className="yt-practice-header">
      <div><span className="nf-overline">LISTEN · WRITE · CHECK</span><h3>{count > 1 ? 'One passage, one answer.' : 'Listen closely. Write what you hear.'}</h3></div>
      {count > 0 && <span className="yt-attempt-state">{attempt ? props.attemptStateLabel ?? 'First answer saved' : 'Ready to practice'}</span>}
    </div>
    {count > 0 ? <>
      <div className="yt-practice-scope">
        <button className="secondary" aria-label="Previous sentence" disabled={busy || !props.hasPrevious} onClick={props.onPrevious}><ChevronLeft size={17}/></button>
        <div>{props.selectedSentenceIndexes[0] !== undefined && <label className="yt-scope-mark"><input type="checkbox" checked={checked.includes(props.selectedSentenceIndexes[0])} disabled={busy} onChange={() => props.onToggleSentence(props.selectedSentenceIndexes[0])}/>Mark sentence {props.selectedSentenceIndexes[0] + 1}</label>}<strong>{label}</strong><span className="yt-scope-time">In video: {sectionTime(start)} – {sectionTime(end)} <b>· {sectionDuration(start, end)}</b></span><small>{count > 1 ? 'Write all selected sentences in one answer.' : 'Listen as often as you need before checking.'}</small></div>
        <button className="secondary" aria-label="Next sentence" disabled={busy || !props.hasNext} onClick={props.onNext}><ChevronRight size={17}/></button>
      </div>
      <div className="yt-marked-actions"><span>{checked.length ? `${checked.length} marked · ${rangeCount} sentence${rangeCount === 1 ? '' : 's'} in section${rangeStart !== undefined && rangeEnd !== undefined ? ` · ${sectionDuration(rangeStart, rangeEnd)}` : ''}` : 'Mark sentences with the checkbox as you move with the arrows.'}</span><button type="button" className="text-button" disabled={!checked.length} onClick={props.onClearSentences}>Clear</button><button type="button" className="secondary" disabled={!canUseChecked} onClick={useChecked}>Use checked sentences</button></div>
      {rangeCount > 100 && <small className="yt-sentence-limit">Choose a section of up to 100 sentences.</small>}
      {props.sentences.length > 0 && <details className="yt-sentence-picker" onToggle={event => {if(event.currentTarget.open) requestAnimationFrame(centerCurrentSentence);}}>
        <summary>Choose sentences here <span>{checked.length ? `${checked.length} checked` : 'No sentences checked'}</span></summary>
        <p>Click a sentence to practice it now. Check several sentences, then use the checked section to practice them together.</p>
        <div className="yt-sentence-list" ref={sentenceList} role="group" aria-label="Practice sentence selection">
          {props.sentences.map((sentence, index) => <div className={`yt-sentence-row ${checked.includes(index) ? 'is-checked' : ''} ${props.selectedSentenceIndexes.includes(index) ? 'is-current' : ''}`} key={`${sentence.key}:${index}`} data-current-sentence={index === props.selectedSentenceIndexes[0] ? 'true' : undefined}>
            <input type="checkbox" aria-label={`Mark sentence ${index + 1}`} checked={checked.includes(index)} disabled={busy} onChange={() => props.onToggleSentence(index)}/>
            <span className="yt-sentence-number">{index + 1}</span>
            <button type="button" className="yt-sentence-detail" aria-current={props.selectedSentenceIndexes.includes(index) ? 'true' : undefined} disabled={busy} onClick={() => props.onSelectSentence(index)}><strong>{sentence.text || 'Listen first'}</strong><small>{sectionTime(sentence.start)} – {sectionTime(sentence.end)} · {sectionDuration(sentence.start, sentence.end)}</small></button>
          </div>)}
        </div>
      </details>}
      {playback}
      <form ref={form} onSubmit={event => {event.preventDefault(); if (canSubmit) props.onSubmit();}}>
        <label className="dictation-label">Your answer<textarea placeholder="Type everything you hear…" value={attempt?.answer ?? answer} readOnly={!!attempt} aria-describedby="practice-shortcuts" maxLength={20000} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" onChange={event => props.onAnswer(event.target.value)}/></label>
        <div className="yt-answer-options">
          <label className="check-label"><Checkbox checked={attempt?.captions ?? captions} disabled={!!attempt || busy} onCheckedChange={value => props.onCaptions(value === true)}/>I used captions or a hint</label>
          <small id="practice-shortcuts">Alt/Option + R to replay · Ctrl/⌘ + Enter to check</small>
        </div>
        {attempt ? <div className="answer-feedback" role="status">
          <div className="yt-feedback-heading"><strong>{attempt.accuracy}% word match</strong><span>{attempt.captions ? 'Captions / hint used' : 'Without hints'}</span></div>
          <span className="nf-overline">REFERENCE TRANSCRIPT</span><p>{transcript}</p>
          <small>{props.feedbackHelp ?? 'Your first answer is saved. Capitalization, punctuation, and some contractions are normalized. Replay the section to listen for what you missed.'}</small>
          {props.hasNext && <button type="button" className="secondary" disabled={busy} onClick={props.onNext}>Next sentence<ChevronRight size={16}/></button>}
        </div> : <div className="yt-submit-row"><button type="submit" className="primary" disabled={!canSubmit} aria-keyshortcuts="Control+Enter Meta+Enter"><Check size={17}/>{busy ? 'Saving…' : 'Check answer'}</button><small>{props.submitHelp ?? 'Your first answer is saved when you check it.'}</small></div>}
      </form>
      <p className="yt-selection-help">Use the checkbox between the arrows or open Choose sentences here. Turn on Repeat to loop the selected section.</p>
    </> : <>{playback}<div className="youtube-empty"><BookOpen size={30}/><h3>{props.emptyTitle ?? 'Add captions to start dictation.'}</h3><p>{props.emptyBody ?? 'You can play the video now. Import English captions or upload a VTT/SRT file to practice and check your answers.'}</p><div className="button-row"><button className="secondary" onClick={props.onImport}>{props.emptyActionLabel ?? 'Upload VTT / SRT'}</button><button className="text-button" onClick={props.onNotes}>Take notes while listening</button></div></div></>}
  </div>;
}
