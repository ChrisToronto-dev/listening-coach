'use client';
import { useRef } from 'react';
import { Play, Pause, RotateCcw, Repeat2, Check, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTime, type VideoAttempt } from '@/lib/youtube';
import type { YouTubePlayerStatus } from './youtube-player';
import './youtube-practice.css';

type Props = {
  status: YouTubePlayerStatus; start: number; end: number; loop: boolean; busy: boolean;
  count: number; label: string; answer: string; captions: boolean; attempt?: VideoAttempt;
  transcript: string; hasPrevious: boolean; hasNext: boolean;
  onPlay: () => void; onReplay: () => void; onLoop: (next: boolean) => void;
  onAnswer: (text: string) => void; onCaptions: (next: boolean) => void;
  onSubmit: () => void; onPrevious: () => void; onNext: () => void;
  onImport: () => void; onNotes: () => void;
};

export function YouTubePractice(props: Props) {
  const { status, start, end, loop, busy, count, label, answer, captions, attempt, transcript } = props;
  const form = useRef<HTMLFormElement>(null);
  const canSubmit = count > 0 && !attempt && !busy && !!answer.trim();
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
      {count > 0 && <span className="yt-attempt-state">{attempt ? 'First answer saved' : 'Ready to practice'}</span>}
    </div>
    <div className="yt-practice-transport" role="group" aria-label="Practice playback">
      <div className="yt-play-buttons">
        <button className="primary" disabled={!status.ready || busy} onClick={props.onPlay}>{status.playing ? <Pause size={18}/> : <Play size={18}/>} {status.playing ? 'Pause' : 'Play'}</button>
        <button className="secondary" disabled={!status.ready || busy} onClick={props.onReplay} aria-keyshortcuts="Alt+R" title="Play from start (Alt/Option + R)"><RotateCcw size={17}/>Play from start</button>
        <button className="yt-repeat" role="switch" aria-label="Repeat selection" aria-checked={loop} disabled={!status.ready || busy || !count} onClick={() => props.onLoop(!loop)}><Repeat2 size={17}/>Repeat <strong>{loop ? 'On' : 'Off'}</strong></button>
      </div>
      <div className="yt-playback-info"><span>{count ? `${formatTime(start)} – ${formatTime(end)}` : 'Full video'}</span><small>{!status.ready ? 'Waiting for player' : loop ? 'Repeating your selection' : 'Repeat off · playback continues'}</small></div>
    </div>
    {count > 0 ? <>
      <div className="yt-practice-scope">
        <button className="secondary" aria-label="Previous sentence" disabled={busy || !props.hasPrevious} onClick={props.onPrevious}><ChevronLeft size={17}/></button>
        <div><strong>{label}</strong><small>{count > 1 ? 'Write all selected sentences in one answer.' : 'Listen as often as you need before checking.'}</small></div>
        <button className="secondary" aria-label="Next sentence" disabled={busy || !props.hasNext} onClick={props.onNext}><ChevronRight size={17}/></button>
      </div>
      <form ref={form} onSubmit={event => {event.preventDefault(); if (canSubmit) props.onSubmit();}}>
        <label className="dictation-label">Your answer<textarea placeholder="Type everything you hear…" value={attempt?.answer ?? answer} readOnly={!!attempt} aria-describedby="practice-shortcuts" maxLength={20000} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" onChange={event => props.onAnswer(event.target.value)}/></label>
        <div className="yt-answer-options">
          <label className="check-label"><Checkbox checked={attempt?.captions ?? captions} disabled={!!attempt || busy} onCheckedChange={value => props.onCaptions(value === true)}/>I used captions or a hint</label>
          <small id="practice-shortcuts">Alt/Option + R to replay · Ctrl/⌘ + Enter to check</small>
        </div>
        {attempt ? <div className="answer-feedback" role="status">
          <div className="yt-feedback-heading"><strong>{attempt.accuracy}% word match</strong><span>{attempt.captions ? 'Captions / hint used' : 'Without hints'}</span></div>
          <span className="nf-overline">REFERENCE TRANSCRIPT</span><p>{transcript}</p>
          <small>Your first answer is saved. Capitalization, punctuation, and some contractions are normalized. Replay the section to listen for what you missed.</small>
          {props.hasNext && <button type="button" className="secondary" disabled={busy} onClick={props.onNext}>Next sentence<ChevronRight size={16}/></button>}
        </div> : <div className="yt-submit-row"><button type="submit" className="primary" disabled={!canSubmit} aria-keyshortcuts="Control+Enter Meta+Enter"><Check size={17}/>{busy ? 'Saving…' : 'Check answer'}</button><small>Your first answer is saved when you check it.</small></div>}
      </form>
      <p className="yt-selection-help">Choose sentences in the transcript above, then use Set section or Repeat selection to practice them together.</p>
    </> : <div className="youtube-empty"><BookOpen size={30}/><h3>Add captions to start dictation.</h3><p>You can play the video now. Import English captions or upload a VTT/SRT file to practice and check your answers.</p><div className="button-row"><button className="secondary" onClick={props.onImport}>Upload VTT / SRT</button><button className="text-button" onClick={props.onNotes}>Take notes while listening</button></div></div>}
  </div>;
}
