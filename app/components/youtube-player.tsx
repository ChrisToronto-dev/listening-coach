'use client';
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ExternalLink } from 'lucide-react';
import { boundaryAction } from '@/lib/youtube';
type YTPlayer = {
 playVideo():void; pauseVideo():void; seekTo(time:number,allowSeekAhead:boolean):void;
 getCurrentTime():number; getDuration():number; getPlayerState():number;
 setPlaybackRate(rate:number):void; getAvailablePlaybackRates():number[]; destroy():void;
 getIframe():HTMLIFrameElement;
};
type YouTubeAPI={Player:new(element:HTMLElement,options:{host?:string;videoId:string;width:string;height:string;playerVars:Record<string,string|number>;events:{onReady:(e:{target:YTPlayer})=>void;onStateChange:(e:{data:number})=>void;onError:(e:{data:number})=>void;onAutoplayBlocked:()=>void}})=>YTPlayer};
declare global { interface Window { YT?:YouTubeAPI; onYouTubeIframeAPIReady?:()=>void } }
let apiPromise:Promise<YouTubeAPI>|undefined;
function loadYouTube():Promise<YouTubeAPI>{
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  const timeout=setTimeout(()=>{apiPromise=undefined;reject(new Error('YouTube is taking too long to connect. Check your network and try again.'));},15000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);previous?.();if(window.YT)resolve(window.YT);};
  let script=document.querySelector<HTMLScriptElement>('script[data-listening-youtube]');
  if(script)script.remove();
  script=document.createElement('script');script.dataset.listeningYoutube='true';script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>{clearTimeout(timeout);apiPromise=undefined;script?.remove();reject(new Error('Could not load the YouTube player. Check your network and content-blocking settings.'));};
  document.head.appendChild(script);
 });
 return apiPromise;
}
export type YouTubePlayerStatus={ready:boolean;playing:boolean;time:number;duration:number};
export type PlayerHandle={time:()=>number;duration:()=>number;replay:(time?:number)=>void;pause:()=>void;playPause:()=>void};
export function YouTubePlayer({videoId,start,end,loop,ref,onStatus}:{videoId:string;start:number;end:number;loop:boolean;ref?:Ref<PlayerHandle>;onStatus?:(status:YouTubePlayerStatus)=>void}){
 const host=useRef<HTMLDivElement>(null),player=useRef<YTPlayer|null>(null),lastStatus=useRef(0);
 const [ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1),[rates,setRates]=useState<number[]>([1]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const current=useRef({start,end,loop});
 const tick=useEffectEvent(()=>{
  const p=player.current;if(!p||!ready)return;
  const now=p.getCurrentTime();
  if(Date.now()-lastStatus.current>=400){lastStatus.current=Date.now();onStatus?.({ready:true,playing:p.getPlayerState()===1,time:now,duration:p.getDuration()});}
  const boundary=boundaryAction(now,start,end,loop,p.getPlayerState());
  if(boundary==='restart'){p.seekTo(start,true);p.playVideo();}
  if(boundary==='pause')p.pauseVideo();
 });
 useEffect(()=>{current.current={start,end,loop};},[start,end,loop]);
 useImperativeHandle(ref,()=>({
  time:()=>player.current?.getCurrentTime()??0,
  duration:()=>player.current?.getDuration()??0,
  replay:(time=start)=>{player.current?.seekTo(time,true);player.current?.playVideo();},
  pause:()=>player.current?.pauseVideo(),
  playPause:()=>{
   const p=player.current;if(!p)return;
   setError('');
   if(p.getPlayerState()===1)p.pauseVideo();
   else{const now=p.getCurrentTime();if(now<start||now>=end-.08)p.seekTo(start,true);p.playVideo();}
  },
 }),[start,end]);
 useEffect(()=>{
  let disposed=false,p:YTPlayer|undefined;let readyTimeout:ReturnType<typeof setTimeout>|undefined;
  queueMicrotask(()=>{setReady(false);setPlaying(false);setError('');onStatus?.({ready:false,playing:false,time:0,duration:0});});
  loadYouTube().then(YT=>{
   if(disposed||!host.current)return;
   const target=document.createElement('iframe');target.title='YouTube English listening video';target.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';target.allowFullscreen=true;target.referrerPolicy='strict-origin-when-cross-origin';target.src=`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&playsinline=1&rel=0&start=${Math.floor(current.current.start)}`;host.current.replaceChildren(target);
   readyTimeout=setTimeout(()=>{if(!disposed)setError('The video connection is delayed. If it does not load in preview, open this local app address in regular Chrome.');},20000);
   p=new YT.Player(target,{videoId,width:'100%',height:'100%',playerVars:{origin:window.location.origin,playsinline:1,controls:1,autoplay:0,start:Math.floor(current.current.start),rel:0},events:{
    onReady:({target})=>{if(disposed)return;clearTimeout(readyTimeout);setError('');player.current=target;setReady(true);setRates(target.getAvailablePlaybackRates());onStatus?.({ready:true,playing:false,time:target.getCurrentTime(),duration:target.getDuration()});const iframe=target.getIframe();iframe.title='YouTube English listening video';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';},
    onStateChange:({data})=>{if(!disposed){setPlaying(data===1);const target=player.current;onStatus?.({ready:!!target,playing:data===1,time:target?.getCurrentTime()??0,duration:target?.getDuration()??0});}},
    onError:({data})=>{if(disposed)return;clearTimeout(readyTimeout);setPlaying(false);setError(({2:'Check the video URL.',5:'This browser could not play the video.',100:'This video was deleted or made private.',101:'This video does not allow embedded playback.',150:'This video does not allow embedded playback.',153:'YouTube could not verify this preview origin. Open the local app address in regular Chrome.'} as Record<number,string>)[data]??`YouTube playback error (${data}). Check the original video status.`);},
    onAutoplayBlocked:()=>{if(!disposed){setPlaying(false);setError('The browser blocked playback. Press the play button inside the video.');}}
   }});
   player.current=p;
  }).catch(e=>{if(!disposed)setError((e as Error).message);});
  return()=>{disposed=true;clearTimeout(readyTimeout);p?.destroy();player.current=null;};
 },[videoId,retry,onStatus]);
 useEffect(()=>{if(!ready)return;player.current?.pauseVideo();player.current?.seekTo(start,true);},[start,end,ready]);
 useEffect(()=>{const interval=setInterval(tick,200);return()=>clearInterval(interval);},[]);
 return <section className="youtube-player" aria-label="YouTube video player"><div className="youtube-frame" ref={host}/>{!ready&&!error&&<p role="status" className="player-status">Connecting to the YouTube player…</p>}{error&&<div role="alert" className="player-error"><p>{error}</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}>Reconnect</button><a href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(start)}s`} target="_blank" rel="noreferrer">Open in YouTube<ExternalLink size={14}/></a></div>}<div className="youtube-speed"><span>Playback speed</span><select value={rate} disabled={!ready} onChange={e=>{const value=Number(e.target.value);setRate(value);player.current?.setPlaybackRate(value);}}>{rates.map(r=><option key={r} value={r}>{r}×</option>)}</select><small>{playing?'Playing':'Pause'}</small></div></section>;
}
