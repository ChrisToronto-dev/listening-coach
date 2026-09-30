import { z } from 'zod';
import { loadLearner, saveLearner } from '@/lib/learner-store';
import { validRange } from '@/lib/youtube';
const clip = z.object({ watchId: z.string().regex(/^\d{1,20}$/), title: z.string().trim().min(1).max(200), start: z.number(), end: z.number(), notes: z.string().max(20000) });
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not save.';
  return Response.json({ error: message === 'AUTH' ? 'Open your learning space first.' : message === 'CONFLICT' ? 'Your data changed in another tab. Save again.' : error instanceof z.ZodError ? 'Check the section and notes.' : message }, { status: message === 'AUTH' ? 401 : message === 'CONFLICT' ? 409 : 400 });
}
export async function GET() {
  try { const { state } = await loadLearner(); return Response.json({ clips: state.netflixClips ?? [] }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin) return new Response('Forbidden', { status: 403 });
    const raw = await req.text();
    if (raw.length > 100000) return new Response('Too large', { status: 413 });
    const data = clip.parse(JSON.parse(raw));
    if (!validRange(data.start, data.end)) throw Error('Set the end time after the start time and within 24 hours.');
    const record = await loadLearner();
    record.state.netflixClips ??= [];
    if (record.state.netflixClips.length >= 500) throw Error('You can save up to 500 sections.');
    record.state.netflixClips.unshift({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    await saveLearner(record);
    return Response.json({ clips: record.state.netflixClips });
  } catch (error) { return failure(error); }
}
