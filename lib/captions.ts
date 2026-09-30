import { parseTranscript, type Cue } from './youtube.ts';
import { groupSentenceCues } from './sentence-cues.ts';
function stamp(value:number){const ms=Math.round(value*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
// YouTube rolling CC repeats the preceding line in short transition cues.
// Remove only the longest contiguous suffix/prefix match within adjacent time ranges.
export function normalizeYouTubeCaptions(vtt:string):Cue[]{
 if(vtt.length>2_000_000)throw new Error('The caption file is too large.');
 const blocks=vtt.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/);
 const rows:Cue[]=[];
 for(const block of blocks){
  if(/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(block))continue;
  const lines=block.split('\n'),i=lines.findIndex(l=>l.includes('-->'));
  if(i<0)continue;
  if(!lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'').trim())continue;
  const parsed=parseTranscript(lines.slice(i).join('\n'))[0];
  if(!parsed)continue;
  rows.push(parsed);
 }
 rows.sort((a,b)=>a.start-b.start);
 const output:Cue[]=[];
 for(const row of rows){
  const previous=output[output.length-1];
  let text=row.text;
  if(previous&&row.start<=previous.end+.12){
   const old=previous.text.split(/\s+/),fresh=text.split(/\s+/);
   let shared=0;
   for(let n=Math.min(old.length,fresh.length);n>0;n--){if(old.slice(-n).join(' ')===fresh.slice(0,n).join(' ')){shared=n;break;}}
   if(shared===fresh.length){previous.end=Math.max(previous.end,row.end);continue;}
   if(shared>0)text=fresh.slice(shared).join(' ');
   if(previous.end>row.start)previous.end=row.start;
  }
  if(row.end-row.start<.08)continue;
  output.push({...row,text});
 }
 // Join screen-sized captions into sentences. The original timestamps bound
 // each row; a boundary inside one row is estimated from its text position.
 const chunks:Cue[]=groupSentenceCues(output).map(({start,end,text})=>({start,end,text}));
 if(!chunks.length||chunks.length>1500)throw new Error('Could not find usable English caption segments.');
 return chunks;
}
export function captionsToVtt(cues:Cue[]){return 'WEBVTT\n\n'+cues.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`).join('\n\n');}
