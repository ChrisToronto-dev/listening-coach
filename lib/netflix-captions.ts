import type { Cue } from './youtube';

export type CaptionSample = { time: number; text: string };
export type CaptionTrack = { watchId: string; title: string; cues: Cue[]; updatedAt: number };

// These are observed intervals, not the original subtitle file's exact timings.
export function recordCaption(cues: Cue[], sample: CaptionSample, previous?: CaptionSample): Cue[] {
  if (!Number.isFinite(sample.time) || sample.time < 0 || sample.time >= 86400) return cues;
  const text = sample.text.trim().slice(0, 2000), time = Math.round(sample.time * 1000) / 1000;
  const continuous = previous && time > previous.time && time - previous.time <= 1.5;
  let next = cues;
  // End the preceding caption when it disappears or changes during normal playback.
  if (continuous && previous.text.trim() !== text) {
    next = cues.map(c => c.text === previous.text.trim() && c.start <= previous.time && c.end > time && c.end <= previous.time + .501 ? { ...c, end: time } : c);
  }
  if (!text) return next;
  const cue: Cue = { start: continuous && previous.text.trim() === text ? previous.time : time, end: Math.min(86400, time + .5), text };
  const kept: Cue[] = [];
  for (const old of next) {
    // Repair legacy text only when a newly observed line break proves the missing boundary.
    const sameText = old.text === text || (text.includes('\n') && old.text === text.replace(/\n/g, ''));
    if (sameText && old.start <= cue.end && old.end >= cue.start) {
      cue.start = Math.min(cue.start, old.start); cue.end = Math.max(cue.end, old.end);
    } else kept.push(old);
  }
  kept.push(cue);
  kept.sort((a, b) => a.start - b.start || a.end - b.end);
  if (kept.length > 5000 || JSON.stringify(kept).length > 1_500_000) throw Error('This title has reached the caption storage limit. Previously saved captions are still available.');
  return kept;
}
