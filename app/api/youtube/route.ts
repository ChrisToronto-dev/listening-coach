import { z } from 'zod';
import { loadLearner, saveLearner } from '@/lib/learner-store';
import { attemptKey, sentenceAttemptKey, parseYouTubeUrl, parseTranscript, videoView, validRange } from '@/lib/youtube';
import { groupSentenceCues } from '@/lib/sentence-cues';
import { score } from '@/lib/core';
import { CaptionImportError, fetchYouTubeCaptions } from '@/lib/fetch-youtube-captions';
import { localYouTubeCaptions } from '@/lib/local-youtube-captions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('captions'),id:z.string().min(1).max(100)}),
 z.object({action:z.literal('add'),url:z.string().max(2000),title:z.string().trim().min(1).max(160)}),
 z.object({action:z.literal('transcript'),id:z.string(),transcript:z.string().max(500000),rightsBasis:z.string().trim().min(5).max(1000),confirmed:z.literal(true),captionSource:z.enum(['youtube-auto','youtube-captions']).optional()}),
 z.object({action:z.literal('notes'),id:z.string(),notes:z.string().max(20000)}),
 z.object({action:z.literal('delete'),id:z.string()}),
 z.object({action:z.literal('range'),id:z.string(),start:z.number(),end:z.number(),sentenceIndexes:z.array(z.number().int().min(0)).min(1).max(100).optional()}),
 z.object({action:z.literal('select'),id:z.string(),index:z.number().int().min(0),start:z.number().optional(),end:z.number().optional(),sentenceIndex:z.number().int().min(0).optional()}),
 z.object({action:z.literal('attempt'),id:z.string(),index:z.number().int().min(0).optional(),indexes:z.array(z.number().int().min(0)).min(1).max(100).optional(),sentenceIndexes:z.array(z.number().int().min(0)).min(1).max(100).optional(),answer:z.string().trim().min(1).max(20000),captions:z.boolean()}),
 z.object({action:z.literal('reveal'),id:z.string(),index:z.number().int().min(0)}),
 z.object({action:z.literal('shadow'),id:z.string(),index:z.number().int().min(0)}),
 z.object({action:z.literal('revealSentence'),id:z.string(),index:z.number().int().min(0)}),
 z.object({action:z.literal('shadowSentence'),id:z.string(),index:z.number().int().min(0)}),
]);
function fail(e:unknown){const message=e instanceof z.ZodError?'Check the information you entered.':e instanceof Error?e.message:'Could not save.';return Response.json({error:message==='AUTH'?'Open your learning space first.':message},{status:e instanceof CaptionImportError?e.status:message==='AUTH'?401:message==='CONFLICT'?409:400});}
export async function GET(){try{const {state}=await loadLearner();return Response.json({videos:state.videos.map(videoView)},{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});
 if(Number(req.headers.get('content-length')??0)>600000)return new Response('Too large',{status:413});
 const p=input.parse(await req.json());let record=await loadLearner(),s=record.state;
 let selected:string;
 if(p.action==='captions'){
  let video=s.videos.find(v=>v.id===p.id);
  if(!video)throw new CaptionImportError('Could not find this item in My Videos.',404);
  if(video.cues.length)throw new CaptionImportError('A transcript is already saved. Your existing practice history was kept.',409);
  const result=await localYouTubeCaptions(video.videoId)??await fetchYouTubeCaptions(video.videoId,new URL(req.url).origin,req.headers.get('cookie')??'');
  // Re-read after downloading to preserve practice-time updates during playback.
  record=await loadLearner();s=record.state;video=s.videos.find(v=>v.id===p.id);
  if(!video)throw new CaptionImportError('Could not find this item in My Videos.',404);
  if(video.cues.length)throw new CaptionImportError('A transcript is already saved. Your existing practice history was kept.',409);
  video.cues=result.cues;video.captionSource=result.automatic?'youtube-auto':'youtube-captions';
  video.rightsBasis=`Personal study requested by the user: public YouTube ${result.automatic?'automatic':'English'} captions (${result.language})`;
  video.start=result.cues[0].start;video.end=result.cues[0].end;video.updatedAt=new Date().toISOString();selected=video.id;
 } else if(p.action==='add'){
  const parsed=parseYouTubeUrl(p.url),existing=s.videos.find(v=>v.videoId===parsed.videoId);
  if(existing)selected=existing.id;
  else {if(s.videos.length>=100)throw new Error('You can currently save up to 100 videos.');const now=new Date().toISOString();const video={...parsed,id:crypto.randomUUID(),title:p.title,createdAt:now,updatedAt:now,cues:[],rightsBasis:'',notes:'',end:Math.min(parsed.start+30,86400),attempts:{},revealed:[],shadowed:[],selectedCue:0};s.videos.push(video);selected=video.id;}
 } else if(p.action==='delete'){
  const index=s.videos.findIndex(video=>video.id===p.id);
  if(index<0)throw new Error('Could not find the video in your library.');
  s.videos.splice(index,1);selected=s.videos[0]?.id??'';
 } else {
  const video=s.videos.find(v=>v.id===p.id);if(!video)throw new Error('Could not find the video in your library.');selected=video.id;
  if(p.action==='transcript'){
   if(video.cues.length)throw new Error('Uploaded captions are not overwritten so your learning history stays intact.');
   video.cues=parseTranscript(p.transcript);video.captionSource=p.captionSource;video.rightsBasis=p.rightsBasis;video.start=video.cues[0].start;video.end=video.cues[0].end;
  }
  if(p.action==='notes')video.notes=p.notes;
  if(p.action==='range'){
   if(!validRange(p.start,p.end))throw new Error('Set the end time after the start time and within 24 hours.');
   if(p.sentenceIndexes){
    const sentences=groupSentenceCues(video.cues), chosen=p.sentenceIndexes;
    if(!chosen.length||chosen.some((index,i)=>!sentences[index]||(i>0&&index<=chosen[i-1]))||sentences[chosen[0]].start!==p.start||sentences[chosen.at(-1)!].end!==p.end)throw new Error('Choose sentences matching the practice section.');
   }
   video.start=p.start;video.end=p.end;video.selectedSentence=undefined;video.selectedSentences=p.sentenceIndexes;
  }
  if(p.action==='attempt'){
   if(p.sentenceIndexes && (p.index!==undefined||p.indexes))throw new Error('Choose the dictation section using one selection method.');
   const sentences=p.sentenceIndexes?groupSentenceCues(video.cues):[];
   const chosen=p.sentenceIndexes??[], indexes=p.sentenceIndexes
    ? [...new Set(chosen.flatMap(index=>{const cue=sentences[index];return cue?Array.from({length:cue.lastIndex-cue.firstIndex+1},(_,i)=>cue.firstIndex+i):[];}))]
    : p.indexes??(p.index===undefined?[]:[p.index]);
   if(p.sentenceIndexes){if(!chosen.length||chosen.some((index,i)=>!sentences[index]||(i>0&&index<=chosen[i-1])))throw new Error('Select sentences in order.');}
   else if(!indexes.length||indexes.some((index,i)=>!video.cues[index]||(i>0&&index!==indexes[i-1]+1)))throw new Error('Select consecutive caption segments in order.');
   const key=p.sentenceIndexes?sentenceAttemptKey(chosen):attemptKey(indexes);
   const target=p.sentenceIndexes?chosen.map(index=>sentences[index].text).join(' '):indexes.map(index=>video.cues[index].text).join(' ');
   if(!video.attempts[key])video.attempts[key]={answer:p.answer,accuracy:score(p.answer,target),captions:p.captions||indexes.some(index=>video.revealed.includes(index))||chosen.some(index=>video.revealedSentences?.includes(index)),createdAt:new Date().toISOString(),...(indexes.length>1||p.sentenceIndexes?{indexes}:{}),...(p.sentenceIndexes?{sentenceIndexes:chosen}:{})};
  }
  if(p.action==='select'||p.action==='reveal'||p.action==='shadow'){
   const cue=video.cues[p.index];if(!cue)throw new Error('Could not find the caption segment.');
   if(p.action==='select'){
   if((p.start===undefined)!==(p.end===undefined) || (p.start!==undefined && !validRange(p.start,p.end!)))throw new Error('Check the sentence start and end times.');
    if(p.sentenceIndex!==undefined){
     const sentence=groupSentenceCues(video.cues)[p.sentenceIndex];
     if(!sentence||sentence.firstIndex!==p.index||p.start!==sentence.start||p.end!==sentence.end)throw new Error('Check the selected sentence section.');
    }
    video.selectedCue=p.index;video.start=p.start??cue.start;video.end=p.end??cue.end;
    video.selectedSentence=p.sentenceIndex;video.selectedSentences=undefined;
   }
   if(p.action==='reveal'&&!video.revealed.includes(p.index))video.revealed.push(p.index);
   if(p.action==='shadow'&&!video.shadowed.includes(p.index))video.shadowed.push(p.index);
  }
  if(p.action==='revealSentence'||p.action==='shadowSentence'){
   if(!groupSentenceCues(video.cues)[p.index])throw new Error('Could not find the sentence.');
   const field=p.action==='revealSentence'?'revealedSentences':'shadowedSentences';
   video[field]??=[];
   if(!video[field].includes(p.index))video[field].push(p.index);
  }
  video.updatedAt=new Date().toISOString();
 }
 await saveLearner(record);return Response.json({videos:s.videos.map(videoView),selected});
 }catch(e){return fail(e)}}
