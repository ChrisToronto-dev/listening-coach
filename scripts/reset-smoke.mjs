// Clears only the local synthetic account used by tests/api-smoke.mjs.
const login=await fetch('http://127.0.0.1:5173/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
const r=await fetch('http://127.0.0.1:5173/api/coach',{method:'POST',headers:{cookie,origin:'http://127.0.0.1:5173','Content-Type':'application/json'},body:JSON.stringify({action:'reset'})});
console.log('Local smoke record reset:',r.status);
