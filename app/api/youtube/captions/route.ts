import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const input = z.object({ id: z.string().min(1).max(100) });
const headers = { 'Cache-Control': 'no-store' };

// Use the existing video API for both reading and saving. Vercel functions
// have separate /tmp directories when no shared database is configured.
export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    if (req.headers.get('origin') !== origin) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    const raw = await req.text();
    if (raw.length > 2048) return Response.json({ error: 'The request is too large.' }, { status: 413, headers });
    const { id } = input.parse(JSON.parse(raw));
    const response = await fetch(new URL('/api/youtube', origin), {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(55_000),
      headers: { 'Content-Type': 'application/json', origin, cookie: req.headers.get('cookie') ?? '' },
      body: JSON.stringify({ action: 'captions', id }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) return Response.json({ error: 'The caption service is unavailable. Try again or upload a VTT/SRT file.' }, { status: 503, headers });
    return Response.json(await response.json(), { status: response.status, headers });
  } catch (error) {
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json({ error: invalid ? 'Check the information you entered.' : 'Could not reach the caption service. Try again or upload a VTT/SRT file.' }, { status: invalid ? 400 : 502, headers });
  }
}
