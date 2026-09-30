import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const destination = resolve('public/downloads/listening-coach-netflix.zip');
mkdirSync(resolve('public/downloads'), { recursive: true });
rmSync(destination, { force: true });
execFileSync('zip', ['-q', destination, 'manifest.json', 'protocol.js', 'player-control.js', 'background.js', 'local-bridge.js', 'netflix.js'], { cwd: resolve('extensions/netflix-companion') });
console.log('Netflix companion packaged: public/downloads/listening-coach-netflix.zip');
