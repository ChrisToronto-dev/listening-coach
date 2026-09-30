import type { VideoStudy } from './youtube';
import type { NetflixClip } from './netflix';
export const stageNames=['Expression Warm-up','First Listen','Sentence Dictation','Learn Expressions','Listen Again','Shadowing','Spaced Review'];
export const stageMinutes=(mode:number)=>mode===30?[3,5,8,4,4,3,3]:[5,8,17,10,8,7,5];
export function localDate(timezone='America/Toronto',now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function nextDate(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function nextInterval(current:number,success:boolean){return success?([1,3,7,14,30].find(n=>n>current)??30):1}
export function normalize(s:string){return s.toLowerCase().replace(/[’]/g,"'").replace(/\bi'd\b/g,'i would').replace(/\bi'm\b/g,'i am').replace(/\bit's\b/g,'it is').replace(/\bdon't\b/g,'do not').replace(/\bcan't\b/g,'cannot').replace(/\bwe're\b/g,'we are').replace(/[^a-z0-9\s]/g,'').trim().split(/\s+/).filter(Boolean)}
export function score(answer:string,target:string){const a=normalize(answer),b=normalize(target);const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return Math.max(0,Math.round(100*(1-d[a.length][b.length]/Math.max(1,b.length))))}
export type SavedExpression={id:string;phrase:string;meaning:string;example:string;tip:string;due:string;interval:number;results:boolean[]};
export type Session={id:string;date:string;lesson:number;stage:number;done:boolean;seconds:number;lastBeat:number;skipped:number[];attempts:Record<string,{answer:string;score:number;target:string;captions:boolean}>};
export type MediaPracticeDay={youtubeSeconds:number;netflixSeconds:number};
export type State={netflixClips?:NetflixClip[];videos:VideoStudy[];mediaPractice?:Record<string,MediaPracticeDay>;profile:{name:string;timezone:string;mode:number;interests:string[];onboarded:boolean};sessions:Session[];expressions:SavedExpression[];saved:number[];candidates:string[];assigned:Record<string,number>};
export function freshState():State{return {videos:[],mediaPractice:{},profile:{name:'Learner',timezone:'America/Toronto',mode:60,interests:['Everyday Life','Work & Career'],onboarded:false},sessions:[],expressions:[],saved:[],candidates:[],assigned:{}}}
export function practiceSeconds(day?:Partial<MediaPracticeDay>){return Math.max(0,day?.youtubeSeconds??0)+Math.max(0,day?.netflixSeconds??0)}
