'use client';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { MediaPracticeDay } from '@/lib/core';

type Source='youtube'|'netflix';
let writeQueue=Promise.resolve();
function saveBatch(source:Source,seconds:number){
 writeQueue=writeQueue.catch(()=>{}).then(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   const response=await fetch('/api/practice-time',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,seconds}),keepalive:true});
   if(response.status===409&&attempt===0)continue;
   if(!response.ok)return;
   const data=await response.json() as {mediaPractice:Record<string,MediaPracticeDay>};
   window.dispatchEvent(new CustomEvent('coach-practice-time',{detail:data.mediaPractice}));
   return;
  }
 });
}

export function useMediaPracticeTime(source:Source,active:boolean){
 const pending=useRef(0);
 const flush=useEffectEvent(()=>{const seconds=pending.current;if(seconds<1)return;pending.current=0;saveBatch(source,seconds);});
 const tick=useEffectEvent(()=>{if(active&&document.visibilityState==='visible'){pending.current++;if(pending.current>=15)flush();}});
 useEffect(()=>{const timer=setInterval(tick,1000);const visibility=()=>{if(document.visibilityState!=='visible')flush();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(timer);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);flush();};},[]);
 useEffect(()=>{if(!active)flush();},[active]);
}
