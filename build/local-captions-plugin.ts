import type { Plugin } from 'vite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { normalizeYouTubeCaptions, captionsToVtt } from '../lib/captions';
const run=promisify(execFile);
const errors:Record<string,string>={NO_ENGLISH_CAPTIONS:'No English captions are available for this video.',RATE_LIMITED:'YouTube temporarily limited requests. Try again in a moment.',LOGIN_REQUIRED:'This video requires a sign-in or additional verification, so captions could not be imported.',VIDEO_UNAVAILABLE:'This video was deleted, made private, or is unavailable.',FETCH_FAILED:'Could not import captions. Check your connection or upload a VTT/SRT file.'};
export function localCaptions():Plugin{
 let running=false;
 return {name:'listening-coach-local-captions',apply:'serve',configureServer(server){
 server.middlewares.use('/api/local-captions',async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  const send=(status:number,body:unknown)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  let acquired=false;
  try{
   const host=req.headers.host??'';
   // Only loopback, same-origin requests; never enable this endpoint on a hosted app.
   if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)||req.headers.origin!==`http://${host}`||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??''))return send(403,{error:'Captions can only be imported from the local app.'});
   if(req.method!=='POST')return send(405,{error:'A POST request is required.'});
   const origin=`http://${host}`,headers={cookie:req.headers.cookie??''};
   const account=await fetch(origin+'/api/youtube',{headers});if(!account.ok)return send(401,{error:'Open your learning space first.'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return send(413,{error:'The request is too large.'});}
   const {id}=JSON.parse(raw) as {id?:string};
   const payload=await account.json() as {videos:{id:string;videoId:string;cues:unknown[]}[]};
   const video=payload.videos.find(v=>v.id===id);
   if(!video||!/^[A-Za-z0-9_-]{11}$/.test(video.videoId))return send(404,{error:'Could not find this item in My Videos.'});
   if(video.cues.length)return send(409,{error:'A transcript is already saved. Your existing practice history was kept.'});
   if(running)return send(429,{error:'Another caption import is in progress. Try again when it finishes.'});
   running=true;acquired=true;
   const python=resolve('.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
   try{await access(python);}catch{return send(503,{error:'The local caption tool is not installed. Follow the caption-tool setup steps in the README.'});}
   const {stdout}=await run(python,[resolve('scripts/fetch-captions.py'),video.videoId],{timeout:90000,maxBuffer:3_000_000,windowsHide:true});
   const result=JSON.parse(stdout) as {vtt?:string;automatic:boolean;language:string;error?:string};
   if(result.error||!result.vtt)return send(422,{error:errors[result.error??'FETCH_FAILED']??errors.FETCH_FAILED});
   const cues=normalizeYouTubeCaptions(result.vtt),transcript=captionsToVtt(cues);
   const saved=await fetch(origin+'/api/youtube',{method:'POST',headers:{...headers,origin,'Content-Type':'application/json'},body:JSON.stringify({action:'transcript',id:video.id,transcript,confirmed:true,rightsBasis:`Local personal study requested by the user: public YouTube ${result.automatic?'automatic captions':'English captions'} (${result.language})`,captionSource:result.automatic?'youtube-auto':'youtube-captions'})});
   send(saved.status,await saved.json());
  }catch(e){send(500,{error:(e as {killed?:boolean}).killed?'Caption import timed out. Try again in a moment.':errors.FETCH_FAILED});}
  finally{if(acquired)running=false;}
 });
 }};
}
