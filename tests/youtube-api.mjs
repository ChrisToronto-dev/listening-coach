import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
assert.equal((await fetch(origin+'/api/youtube')).status,401);
const login=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
assert.ok(cookie);
const call=async (body,status=200)=>{const r=await fetch(origin+'/api/youtube',{method:'POST',headers:{'Content-Type':'application/json',cookie,origin},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
const videoId='TEST'+crypto.randomUUID().replaceAll('-','').slice(0,7);
const initial=await call({action:'add',url:`https://youtu.be/${videoId}`,title:'[Automated Test] Not a real video'});
const id=initial.selected;
try {
const duplicate=await call({action:'add',url:`https://www.youtube.com/watch?v=${videoId}`,title:'Duplicate'});assert.equal(duplicate.selected,id);
await call({action:'transcript',id,transcript:'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nI wrote this test sentence.\n\n00:00:03.000 --> 00:00:04.000\nThis is a second original sentence.',rightsBasis:'Original test fixture',confirmed:true});
const get=await (await fetch(origin+'/api/youtube',{headers:{cookie}})).json();assert.equal(get.videos.find(v=>v.id===id).cues[0].text,undefined);
const coach=await (await fetch(origin+'/api/coach',{headers:{cookie}})).text();assert.ok(!coach.includes('I wrote this test sentence.'));
await call({action:'range',id,start:5,end:2},400);
await call({action:'range',id,start:1,end:4});
await call({action:'notes',id,notes:'[0:01] test note'});
const first=await call({action:'attempt',id,index:0,answer:'wrong answer',captions:false});assert.equal(first.videos.find(v=>v.id===id).cues[0].text,'I wrote this test sentence.');
const retry=await call({action:'attempt',id,index:0,answer:'I wrote this test sentence.',captions:false});assert.equal(retry.videos.find(v=>v.id===id).attempts[0].answer,'wrong answer');
await call({action:'reveal',id,index:1});
const hint=await call({action:'attempt',id,index:1,answer:'This is a second original sentence.',captions:false});assert.equal(hint.videos.find(v=>v.id===id).attempts[1].captions,true);
const grouped=await call({action:'attempt',id,indexes:[0,1],answer:'I wrote this test sentence. This is a second original sentence.',captions:false});assert.equal(grouped.videos.find(v=>v.id===id).attempts['range:0-1'].accuracy,100);
const sentence=await call({action:'attempt',id,sentenceIndexes:[0,1],answer:'I wrote this test sentence. This is a second original sentence.',captions:false});assert.equal(sentence.videos.find(v=>v.id===id).attempts['sentence:0-1'].accuracy,100);
const sentenceReveal=await call({action:'revealSentence',id,index:0});assert.deepEqual(sentenceReveal.videos.find(v=>v.id===id).revealedSentences,[0]);
const sentenceShadow=await call({action:'shadowSentence',id,index:0});assert.deepEqual(sentenceShadow.videos.find(v=>v.id===id).shadowedSentences,[0]);
const selectedSentence=await call({action:'select',id,index:0,start:1,end:2,sentenceIndex:0});assert.equal(selectedSentence.videos.find(v=>v.id===id).selectedSentence,0);
const final=await call({action:'select',id,index:1});assert.equal(final.videos.find(v=>v.id===id).selectedCue,1);assert.equal(final.videos.find(v=>v.id===id).notes,'[0:01] test note');
assert.equal(final.videos.find(v=>v.id===id).selectedSentence,undefined);
await call({action:'select',id:'not-owned-id',index:0},400);
await call({action:'transcript',id,transcript:'invalid',rightsBasis:'Original test transcript',confirmed:true},400);
assert.equal((await fetch(origin+'/api/youtube',{method:'POST',headers:{cookie,'Content-Type':'application/json',origin:'https://example.com'},body:JSON.stringify({action:'notes',id,notes:'evil'})})).status,403);
const removed=await call({action:'delete',id});assert.equal(removed.videos.some(v=>v.id===id),false);
await call({action:'delete',id},400);
console.log('PASS: auth, duplicate normalization, transcript privacy across APIs, immutable scoring, grouped dictation, deletion, ranges, notes, selected cue persistence, ownership, CSRF.');
} finally {
 const {execFileSync}=await import('node:child_process');
 // Delete only the temporary entry just created, preserving all user records.
 const sql=`UPDATE learners SET data=json_remove(data, '$.videos[' || (SELECT key FROM json_each(learners.data, '$.videos') WHERE json_extract(value, '$.id')='${id}') || ']'), revision=revision+1 WHERE EXISTS (SELECT 1 FROM json_each(learners.data, '$.videos') WHERE json_extract(value, '$.id')='${id}');`;
 execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',sql],{stdio:'pipe'});
 console.log('Temporary test entry removed; user data preserved.');
}
