// Opt-in real YouTube request through the Vercel Python handler; no learner data is written.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

process.env.APP_SECRET = 'caption-smoke-only-secret';
const { createSessionToken } = await import('../lib/auth-token.ts');
const { fetchYouTubeCaptions } = await import('../lib/fetch-youtube-captions.ts');
const python = resolve('.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const script = `
import importlib.util
from http.server import HTTPServer
spec = importlib.util.spec_from_file_location('caption_function', 'api/youtube-captions.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
server = HTTPServer(('127.0.0.1', 0), module.handler)
print(server.server_port, flush=True)
server.serve_forever()
`;
const server = spawn(python, ['-u', '-c', script], { env: { ...process.env, PYTHONPATH: '.' }, stdio: ['ignore', 'pipe', 'inherit'] });
const lines = createInterface({ input: server.stdout });
try {
  const [port] = await Promise.race([once(lines, 'line'), once(server, 'exit').then(() => { throw Error('Python test server exited'); })]);
  const cookie = `lc_session=${await createSessionToken('caption-smoke-user', 60)}`;
  const result = await fetchYouTubeCaptions('MxkVneD7-HY', `http://127.0.0.1:${port}`, cookie);
  assert.ok(result.cues.length > 0);
  assert.equal(result.language, 'en');
  console.log(`PASS: Node session verified by Python; ${result.cues.length} English caption segments fetched and normalized.`);
} finally {
  lines.close();
  server.kill();
}
