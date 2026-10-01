import { z } from 'zod';
import { loadLearner, saveLearner } from '@/lib/learner-store';
import { localDate } from '@/lib/core';

export const dynamic = 'force-dynamic';

const input=z.object({source:z.enum(['youtube','netflix']),seconds:z.number().int().min(1).max(60)});
function failure(error:unknown){
 const message=error instanceof Error?error.message:'Could not save practice time.';
 return Response.json({error:message==='AUTH'?'Open your learning space first.':message},{status:message==='AUTH'?401:message==='CONFLICT'?409:400});
}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});
 const value=input.parse(await req.json()),record=await loadLearner(),date=localDate(record.state.profile.timezone);
 record.state.mediaPractice??={};
 const day=record.state.mediaPractice[date]??{youtubeSeconds:0,netflixSeconds:0};
 const key=value.source==='youtube'?'youtubeSeconds':'netflixSeconds';
 day[key]=Math.min(86400,day[key]+value.seconds);record.state.mediaPractice[date]=day;
 await saveLearner(record);
 return Response.json({date,day,mediaPractice:record.state.mediaPractice});
 }catch(error){return failure(error)}}
