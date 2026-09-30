import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const origin = 'http://127.0.0.1:5173';
const endpoint = origin + '/api/netflix';
assert.equal((await fetch(endpoint)).status, 401);
const login = await fetch(origin + '/signin-with-chatgpt?return_to=/netflix', { redirect: 'manual' });
const cookie = login.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
const headers = { cookie, origin, 'Content-Type': 'application/json' };
const before = await (await fetch(endpoint, { headers })).json();
const body = { watchId: '123456789', title: '[Automated Test] Netflix fixture', start: 60.2, end: 85.4, notes: 'Synthetic test note, no Netflix content.' };
assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...headers, origin: 'https://example.com' }, body: JSON.stringify(body) })).status, 403);
assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...headers, origin: '' }, body: JSON.stringify(body) })).status, 403);
assert.equal((await fetch(endpoint, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 401);
for (const invalid of [{ start: 90 }, { watchId: 'evil/path' }, { end: 86401 }, { notes: 'x'.repeat(20001) }]) {
  assert.equal((await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...body, ...invalid }) })).status, 400);
}
let fixtureId;
try {
  const saved = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal(saved.status, 200);
  const data = await saved.json(); fixtureId = data.clips[0].id;
  assert.equal(data.clips.length, before.clips.length + 1);
  const restored = await (await fetch(endpoint, { headers })).json();
  assert.equal(restored.clips[0].id, fixtureId); assert.equal(restored.clips[0].start, 60.2); assert.equal(restored.clips[0].notes, body.notes);
  assert.deepEqual(restored.clips.slice(1), before.clips);
  console.log('PASS Netflix API: authentication, same-origin writes, input validation, clip/notes persistence, existing records preserved.');
} finally {
  if (fixtureId) {
    assert.match(fixtureId, /^[a-f0-9-]{36}$/);
    const sql = `UPDATE learners SET data=json_remove(data, '$.netflixClips[' || (SELECT key FROM json_each(learners.data, '$.netflixClips') WHERE json_extract(value, '$.id')='${fixtureId}') || ']'), revision=revision+1 WHERE EXISTS (SELECT 1 FROM json_each(learners.data, '$.netflixClips') WHERE json_extract(value, '$.id')='${fixtureId}');`;
    execFileSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--command', sql], { stdio: 'pipe' });
    console.log('Removed only the synthetic clip created by this test.');
  }
}
