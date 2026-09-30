import type { Cue } from './youtube';

// Positive offset delays the subtitles; selection is start-inclusive/end-exclusive.
export function currentSubtitles(cues: Cue[], time: number, offset = 0) {
  if (!Number.isFinite(time) || !Number.isFinite(offset)) return [];
  return cues.filter(cue => cue.start + offset <= time && time < cue.end + offset);
}
export function rangeSubtitles(cues: Cue[], start: number, end: number, offset = 0) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(offset) || end <= start) return [];
  return cues.filter(cue => cue.start + offset < end && cue.end + offset > start);
}

export function subtitleSelectionRange(cues: Cue[], offset = 0) {
  if (!cues.length || !Number.isFinite(offset)) return null;
  const start = Math.max(0, Math.min(...cues.map(c => c.start)) + offset);
  const end = Math.max(...cues.map(c => c.end)) + offset;
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}
