import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5173';
const login=await fetch(origin+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
async function call(headers,body){return fetch(origin+'/api/youtube/captions',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
assert.equal((await call({cookie},{id:'anything'})).status,403);
assert.equal((await call({cookie,origin:'https://example.com'},{id:'anything'})).status,403);
assert.equal((await call({origin},{id:'anything'})).status,401);
assert.equal((await call({cookie,origin},{id:'not-owned'})).status,404);
const list=await (await fetch(origin+'/api/youtube',{headers:{cookie}})).json();
const v=list.videos.find(x=>x.cues.length>0);
if(v)assert.equal((await call({cookie,origin},{id:v.id})).status,409);
console.log('PASS: local-only origin, authentication, ownership, existing transcript preservation. No external download attempted.');
