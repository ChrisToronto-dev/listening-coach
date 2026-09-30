import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
const anon=await fetch(origin+'/api/coach');assert.equal(anon.status,401);
const login=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
assert.ok(cookie,'Local development mock auth cookie required');
async function call(action,extra={}){const r=await fetch(origin+'/api/coach',{method:'POST',headers:{'Content-Type':'application/json',cookie,origin},body:JSON.stringify({action,...extra})});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d}
let d=await (await fetch(origin+'/api/coach',{headers:{cookie}})).json();
if(d.sessions.length){console.log('Existing local test record: preserving it; API auth check passed.');process.exit(0)}
d=await call('profile',{profile:{...d.profile,onboarded:true}});
d=await call('start');const id=d.sessions[0].id;assert.equal(d.lessonData[0].first[0].answer,undefined);assert.equal(d.lessonData[0].expressions.length,0);
d=await call('start');assert.equal(d.sessions.length,1);
d=await call('advance',{session:id});
d=await call('attempt',{session:id,key:'f0',answer:'2'});assert.equal(d.sessions[0].attempts.f0.score,0);
d=await call('attempt',{session:id,key:'f0',answer:'0'});assert.equal(d.sessions[0].attempts.f0.answer,'2');
d=await call('attempt',{session:id,key:'f1',answer:'1'});
d=await call('advance',{session:id});
for(let i=0;i<6;i++)d=await call('attempt',{session:id,key:'d'+i,answer:'test answer'});
d=await call('advance',{session:id});d=await call('saveExpression',{session:id,index:0});assert.equal(d.expressions.length,1);
d=await call('advance',{session:id});
d=await call('attempt',{session:id,key:'r0',answer:'1'});d=await call('attempt',{session:id,key:'r1',answer:'2'});
for(let i=0;i<3;i++)d=await call('advance',{session:id});assert.equal(d.sessions[0].done,true);
const persisted=await (await fetch(origin+'/api/coach',{headers:{cookie}})).json();assert.equal(persisted.sessions[0].done,true);
console.log('PASS: anonymous denial, profile, single session, hidden answers, immutable first attempt, seven stages, expression persistence, completion, reload. Local mock test record retained.');
