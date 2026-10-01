import { normalizeYouTubeCaptions } from './captions.ts';

export class CaptionImportError extends Error {
  status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}

const errors: Record<string, string> = {
  NO_ENGLISH_CAPTIONS: 'No English captions are available for this video. You can upload your own VTT/SRT transcript.',
  RATE_LIMITED: 'YouTube temporarily limited requests from this server. Try later or upload a VTT/SRT file.',
  LOGIN_REQUIRED: 'YouTube requires sign-in or verification for this video. Open the original video or upload a VTT/SRT file.',
  VIDEO_UNAVAILABLE: 'This video is unavailable. Open the original video to check it.',
};

// Next.js saves account data; a separate Vercel Python function runs yt-dlp.
export async function fetchYouTubeCaptions(videoId: string, origin: string, cookie: string, fetcher: typeof fetch = fetch) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new CaptionImportError('Invalid YouTube video.', 400);
  const signal = AbortSignal.timeout(50_000);
  try {
    const response = await fetcher(new URL('/api/youtube-captions', origin), {
      method: 'POST', signal, cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', origin, cookie },
      body: JSON.stringify({ videoId }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new CaptionImportError('The caption function is unavailable. Redeploy with the Python caption function or upload a VTT/SRT file.', 503);
    }
    const result = await response.json() as { vtt?: string; automatic?: boolean; language?: string; error?: string };
    if (!response.ok || !result.vtt) {
      const message = errors[result.error ?? ''] ?? (response.status === 401 ? 'Your session expired. Sign in again.' : 'Could not import captions from YouTube. Try again or upload a VTT/SRT file.');
      throw new CaptionImportError(message, response.status === 429 || result.error === 'RATE_LIMITED' ? 429 : response.status === 401 ? 401 : 422);
    }
    if (typeof result.vtt !== 'string' || typeof result.automatic !== 'boolean' || typeof result.language !== 'string') {
      throw new CaptionImportError('The caption service returned invalid data. Upload a VTT/SRT file instead.', 502);
    }
    return { cues: normalizeYouTubeCaptions(result.vtt), automatic: result.automatic, language: result.language };
  } catch (error) {
    if (error instanceof CaptionImportError) throw error;
    if (signal.aborted) throw new CaptionImportError('Caption import timed out. Try again or upload a VTT/SRT file.', 504);
    throw new CaptionImportError('Could not reach the caption service. Try again or upload a VTT/SRT file.', 502);
  }
}
