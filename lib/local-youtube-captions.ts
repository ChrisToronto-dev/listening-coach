import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { normalizeYouTubeCaptions } from './captions';
import { CaptionImportError } from './fetch-youtube-captions';

const run = promisify(execFile);

// Keep the installed local extractor available with Next.js as well as Vite.
// Hosted functions use the HTTP implementation and never require .venv/Python.
export async function localYouTubeCaptions(videoId: string) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') return null;
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new CaptionImportError('Invalid YouTube video.', 400);
  const python = resolve('.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  try { await access(python); } catch { return null; }
  try {
    const { stdout } = await run(python, [resolve('scripts/fetch-captions.py'), videoId], { timeout: 45_000, maxBuffer: 3_000_000, windowsHide: true });
    const result = JSON.parse(stdout) as { vtt?: string; automatic: boolean; language: string; error?: string };
    if (!result.vtt) {
      const messages: Record<string, string> = {
        NO_ENGLISH_CAPTIONS: 'No English captions are available for this video.',
        RATE_LIMITED: 'YouTube temporarily limited requests. Try again later or upload a VTT/SRT file.',
        LOGIN_REQUIRED: 'This video requires sign-in or verification. Upload a VTT/SRT file instead.',
        VIDEO_UNAVAILABLE: 'This video is unavailable.',
      };
      throw new CaptionImportError(messages[result.error ?? ''] ?? 'Could not import captions. Upload a VTT/SRT file instead.');
    }
    return { cues: normalizeYouTubeCaptions(result.vtt), automatic: result.automatic, language: result.language };
  } catch (error) {
    if (error instanceof CaptionImportError) throw error;
    throw new CaptionImportError('The local caption tool failed or timed out. Try again or upload a VTT/SRT file.', 502);
  }
}
