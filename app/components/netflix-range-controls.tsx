'use client';
import { Flag, MapPin, Pause, Play, Repeat2, RotateCcw, Check, ArrowRight } from 'lucide-react';
import { TimeField } from './time-field';
import { formatTime, validRange } from '@/lib/youtube';
type RangeStatus = { ready?: boolean; time: number; duration: number; paused: boolean; loop: boolean; start?: number; end?: number };

export function NetflixRangeControls({ status, start, end, disabled, onStart, onEnd, onCapture, onPlayPause, onReplay, onApply }: {
  status: RangeStatus | null; start: number; end: number; disabled: boolean;
  onStart: (value: number) => void; onEnd: (value: number) => void;
  onCapture: (edge: 'start' | 'end') => void; onPlayPause: () => void; onReplay: () => void; onApply: (loop: boolean) => void;
}) {
  const loop = !!status?.loop;
  const changed = loop && (start !== status?.start || end !== status?.end);
  const length = Math.round((end - start) * 10) / 10;
  return <div className="nf-controls">
    <div className="nf-transport">
      <div className="nf-play-actions"><button className="nf-play" disabled={disabled} onClick={onPlayPause}>{status?.paused !== false ? <Play size={18}/> : <Pause size={18}/>} {status?.paused !== false ? 'Play' : 'Pause'}</button><button className="nf-replay" disabled={disabled} onClick={onReplay}><RotateCcw size={17}/>Play from start</button></div>
      <span className="nf-position"><i className={status?.paused === false ? 'is-playing' : ''}/>{formatTime(status?.time ?? 0)}<span>/ {formatTime(status?.duration ?? 0)}</span></span>
    </div>
    <div className="nf-range-card">
      <div className="nf-range-heading"><div><span className="nf-overline">FREE PLAY</span><h4>Custom Playback Section</h4></div><span className="nf-duration">{validRange(start, end) ? `${length} sec section` : 'Check start and end'}</span></div>
      <div className="nf-range-fields">
        <div className="nf-boundary nf-boundary-start"><div className="nf-boundary-label"><span>A</span>Start here</div><TimeField label="Start" value={start} onChange={onStart}/><button className="nf-capture" disabled={disabled} onClick={() => onCapture('start')}><MapPin size={17}/><span>Set current time as start</span></button></div>
        <ArrowRight size={18} className="nf-range-arrow" aria-hidden="true"/>
        <div className="nf-boundary nf-boundary-end"><div className="nf-boundary-label"><span>B</span>Listen until here</div><TimeField label="End" value={end} onChange={onEnd}/><button className="nf-capture" disabled={disabled} onClick={() => onCapture('end')}><Flag size={17}/><span>Set current time as end</span></button></div>
      </div>
      <div className="nf-repeat-footer"><button type="button" role="switch" aria-checked={loop} aria-label="Section repeat" aria-describedby="nf-loop-help" disabled={disabled} className={`nf-loop-toggle ${loop ? 'is-on' : ''}`} onClick={() => onApply(!loop)}><Repeat2 size={20}/><span><strong>Section repeat</strong><small>{loop ? 'On · A ↔ B' : 'Off · keep playing'}</small></span><span className="nf-toggle-track" aria-hidden="true"><span>{loop && <Check size={12}/>}</span></span></button><button className="nf-apply" disabled={disabled || !validRange(start, end)} onClick={() => onApply(true)}>{changed ? 'Apply changes' : 'Repeat this section'}<ArrowRight size={16}/></button></div>
      <p id="nf-loop-help" className="nf-loop-help">{loop ? `Repeating ${formatTime(status?.start ?? start)} – ${formatTime(status?.end ?? end)}${changed ? ' · apply your changes.' : ''}` : 'Turn repeat on to loop from A to B, or turn it off to keep playing.'}</p>
    </div>
  </div>;
}
