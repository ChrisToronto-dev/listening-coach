import type { VideoView } from './youtube.ts';

// Recover the same answer scope as the saved playback range, including grouped sentences.
export function restorePracticeSelection(video: VideoView): { indexes: number[]; sentenceIndexes: number[] | null } {
  const saved = video.selectedSentences;
  if (saved?.length && saved.every((index, i) => video.transcriptCues[index] && (i === 0 || index > saved[i - 1])) && video.transcriptCues[saved[0]].start === video.start && video.transcriptCues[saved.at(-1)!].end === video.end) {
    return { indexes: [...new Set(saved.flatMap(index => {
      const sentence = video.transcriptCues[index];
      return Array.from({ length: sentence.lastIndex - sentence.firstIndex + 1 }, (_, offset) => sentence.firstIndex + offset);
    }))].sort((a, b) => a - b), sentenceIndexes: saved };
  }
  const sentence = video.selectedSentence;
  if (sentence !== undefined && video.transcriptCues[sentence]) {
    return { indexes: [video.transcriptCues[sentence].firstIndex], sentenceIndexes: [sentence] };
  }
  const cue = video.cues[video.selectedCue];
  if (cue && cue.start === video.start && cue.end === video.end) {
    return { indexes: [video.selectedCue], sentenceIndexes: null };
  }
  const sentences = video.transcriptCues.map((cue, index) => ({ cue, index })).filter(({ cue }) => cue.start >= video.start && cue.end <= video.end);
  if (sentences.length && sentences[0].cue.start === video.start && sentences.at(-1)!.cue.end === video.end) {
    return { indexes: [sentences[0].cue.firstIndex], sentenceIndexes: sentences.map(({ index }) => index) };
  }
  const indexes = video.cues.map((cue, index) => ({ cue, index })).filter(({ cue }) => cue.start >= video.start && cue.end <= video.end).map(({ index }) => index);
  if (indexes.length && video.cues[indexes[0]].start === video.start && video.cues[indexes.at(-1)!].end === video.end) return { indexes, sentenceIndexes: null };
  return { indexes: cue ? [video.selectedCue] : [], sentenceIndexes: null };
}
