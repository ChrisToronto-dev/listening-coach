import type { Cue } from './youtube';

export type SentenceCue = Cue & { key: string; firstIndex: number; lastIndex: number };

// Caption files describe screen changes, which often happen in the middle of a
// sentence. Build practice rows from punctuation without changing saved cues.
export function groupSentenceCues(cues: (Omit<Cue, 'text'> & { text?: string })[]): SentenceCue[] {
  const sentences: SentenceCue[] = [];
  let pending: SentenceCue | undefined;
  const flush = () => {
    if (pending?.text.trim()) sentences.push({ ...pending, text: pending.text.trim() });
    pending = undefined;
  };
  for (const [index, cue] of cues.entries()) {
    if (cue.end <= cue.start) continue;
    const text = cue.text?.replace(/\s+/g, ' ').trim() ?? '';
    if (!text) {
      flush();
      sentences.push({ key: `${cue.start}:hidden`, firstIndex: index, lastIndex: index, start: cue.start, end: cue.end, text: '' });
      continue;
    }
    if (pending && (cue.start - pending.end > 2.5 || cue.end - pending.start > 45 || pending.text.length + text.length > 580)) flush();
    let cursor = 0;
    // Keep punctuation and closing quotes with the sentence. Allow captions
    // that omit the space after a period, but keep common abbreviations intact.
    const boundary = /[.!?]+["'”’)]*(?=\s|[A-Z]|$)/g;
    for (const match of text.matchAll(boundary)) {
      const end = match.index + match[0].length;
      if (match[0].startsWith('.') && /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|[A-Z])\.$/i.test(text.slice(0, match.index + 1))) continue;
      const part = text.slice(cursor, end).trim();
      if (part) {
        const partStart = cue.start + (cue.end - cue.start) * cursor / text.length;
        const partEnd = cue.start + (cue.end - cue.start) * end / text.length;
        if (!pending) pending = { key: `${cue.start}:${cursor}`, firstIndex: index, lastIndex: index, start: partStart, end: partEnd, text: part };
        else { pending.text += ` ${part}`; pending.end = partEnd; pending.lastIndex = index; }
        flush();
      }
      cursor = end;
    }
    const tail = text.slice(cursor).trim();
    if (tail) {
      const start = cue.start + (cue.end - cue.start) * cursor / text.length;
      if (!pending) pending = { key: `${cue.start}:${cursor}`, firstIndex: index, lastIndex: index, start, end: cue.end, text: tail };
      else { pending.text += ` ${tail}`; pending.end = cue.end; pending.lastIndex = index; }
    }
  }
  flush();
  return sentences;
}
