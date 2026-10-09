import { groupSentenceCues, type SentenceCue } from './sentence-cues.ts';
export type Cue = { start: number; end: number; text: string };
export type VideoAttempt = { answer: string; accuracy: number; captions: boolean; createdAt: string; indexes?: number[]; sentenceIndexes?: number[] };
export type VideoStudy = {
  captionSource?: 'youtube-auto' | 'youtube-captions';
  id: string; videoId: string; title: string; url: string; createdAt: string;
  cues: Cue[]; rightsBasis: string; notes: string; start: number; end: number;
  attempts: Record<string, VideoAttempt>; revealed: number[]; shadowed: number[];
  revealedSentences?: number[]; shadowedSentences?: number[];
  selectedCue: number; updatedAt: string;
  selectedSentence?: number;
  selectedSentences?: number[];
};
export type VideoView = Omit<VideoStudy, 'cues'> & {
  cues: { start: number; end: number; text?: string }[];
  transcriptCues: (Omit<SentenceCue, 'text'> & { text?: string })[];
};
export function attemptKey(indexes: number[]) {
  return indexes.length === 1 ? String(indexes[0]) : `range:${indexes[0]}-${indexes[indexes.length - 1]}`;
}
export function sentenceAttemptKey(indexes: number[]) {
  const contiguous = indexes.every((index, position) => position === 0 || index === indexes[position - 1] + 1);
  return contiguous ? `sentence:${indexes[0]}-${indexes[indexes.length - 1]}` : `sentence-set:${indexes.join(',')}`;
}
export function parseYouTubeUrl(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid YouTube video URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Use a YouTube URL that starts with https://.');
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live'].includes(parts[0]) && parts.length === 2) id = parts[1];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Enter a single YouTube video URL instead of a playlist.');
  const rawTime = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '0';
  const match = rawTime.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  const start = /^\d+$/.test(rawTime) ? Number(rawTime) : match ? Number(match[1] ?? 0)*3600+Number(match[2] ?? 0)*60+Number(match[3] ?? 0) : 0;
  return { videoId: id, url: `https://www.youtube.com/watch?v=${id}`, start: Math.min(start, 86399) };
}
function parseTimestamp(value: string) {
  const m=value.match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!m || Number(m[2])>59 || Number(m[3])>59) throw new Error(`Check the subtitle timestamp format: ${value}`);
  return Number(m[1]??0)*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;
}
export function parseTranscript(source: string, options: { maxCues?: number; maxLength?: number; allowOverlap?: boolean } = {}): Cue[] {
  const maxCues = options.maxCues ?? 1500, maxLength = options.maxLength ?? 500000;
  if(source.length>maxLength) throw new Error(`Keep the transcript under ${maxLength.toLocaleString('en-US')} characters.`);
  const blocks=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n[\t ]*\n/);
  const cues:Cue[]=[];
  for(const block of blocks){
    if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(block)) continue;
    const lines=block.trim().split('\n');
    const timeLine=lines.findIndex(line=>line.includes('-->'));
    if(timeLine<0) throw new Error('Paste a timestamped transcript in VTT or SRT format.');
    const time=lines[timeLine].match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
    if(!time) throw new Error('Check the subtitle start and end times.');
    const start=parseTimestamp(time[1]),end=parseTimestamp(time[2]);
    const text=lines.slice(timeLine+1).join(' ').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').trim();
    if(!text||text.length>600) throw new Error('Each subtitle needs between 1 and 600 characters.');
    if(start<0||end<=start||end>86400) throw new Error('Subtitle end times must come after start times and stay within 24 hours.');
    if(cues.length&&start<(options.allowOverlap?cues[cues.length-1].start:cues[cues.length-1].end)) throw new Error('Some subtitles overlap or are out of order. Adjust their times.');
    cues.push({start,end,text});
  }
  if(!cues.length||cues.length>maxCues) throw new Error(`Add between 1 and ${maxCues.toLocaleString('en-US')} subtitle segments.`);
  return cues;
}
export function videoView(video: VideoStudy): VideoView {
  const attempted = new Set<number>();
  const attemptedSentences = new Set<number>();
  for (const [key, value] of Object.entries(video.attempts)) {
    if (value.sentenceIndexes?.length) value.sentenceIndexes.forEach(index => attemptedSentences.add(index));
    else if (value.indexes?.length) value.indexes.forEach(index => attempted.add(index));
    else if (/^\d+$/.test(key)) attempted.add(Number(key));
  }
  const visible = (index: number) => attempted.has(index) || video.revealed.includes(index);
  return {...video,
    cues:video.cues.map((cue,i)=>({start:cue.start,end:cue.end,...(visible(i)?{text:cue.text}:{})})),
    transcriptCues:groupSentenceCues(video.cues).map((cue,sentenceIndex)=>({key:cue.key,firstIndex:cue.firstIndex,lastIndex:cue.lastIndex,start:cue.start,end:cue.end,...(attemptedSentences.has(sentenceIndex)||video.revealedSentences?.includes(sentenceIndex)||Array.from({length:cue.lastIndex-cue.firstIndex+1},(_,i)=>cue.firstIndex+i).every(visible)?{text:cue.text}:{})})),
  };
}
export function formatTime(seconds:number){const value=Math.floor(Math.max(0,seconds));return `${String(Math.floor(value/3600)).padStart(2,'0')}:${String(Math.floor(value/60)%60).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
export function validRange(start:number,end:number){return Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&end<=86400;}
export function boundaryAction(time:number,start:number,end:number,loop:boolean,state:number):'none'|'restart'|'pause'{
  // Unchecked means normal playback: the selected range is only a starting
  // point, so let the YouTube player continue past its end. Only an enabled
  // loop should intervene at the boundary.
  if(state!==1||!loop||!validRange(start,end)||time<end-.08)return 'none';
  return 'restart';
}
export function timeParts(value:number){const ms=Math.round(Math.max(0,Number.isFinite(value)?value:0)*1000);return {hours:Math.floor(ms/3600000),minutes:Math.floor(ms/60000)%60,seconds:(ms%60000)/1000};}
export function secondsFromParts(parts:{hours:number;minutes:number;seconds:number}){return Math.round((parts.hours*3600+parts.minutes*60+parts.seconds)*1000)/1000;}
