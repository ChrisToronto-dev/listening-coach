'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { captionTrack } from '@/lib/netflix-caption-store';
import type { CaptionSample, CaptionTrack } from '@/lib/netflix-captions';

// The caller keys its component by watchId, isolating each movie / episode's lifecycle.
export function useNetflixCaptions(watchId: string, title: string, time: number, text: string, connected: boolean) {
  const [track, setTrack] = useState<CaptionTrack | null>(null), [error, setError] = useState('');
  const [saving, setSaving] = useState(false), [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0);
  const previous = useRef<CaptionSample | undefined>(undefined), busy = useRef(false), alive = useRef(false);
  const failed = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let live = true;
    captionTrack(watchId).then(data => { if (live) { setTrack(data); setLoaded(true); setError(''); failed.current = false; } })
      .catch(() => { if (live) setError('Could not open caption storage. Check browser site storage and try again.'); });
    return () => { live = false; };
  }, [watchId, retry]);
  useEffect(() => {
    if (!connected) { previous.current = undefined; return; }
    if (!loaded || busy.current || failed.current) return;
    const sample = { time, text: text.trim().slice(0, 2000) }, last = previous.current;
    if (!Number.isFinite(time) || (last?.time === time && last.text === sample.text)) return;
    if (!sample.text && !last?.text) { previous.current = sample; return; }
    busy.current = true; setSaving(true);
    captionTrack(watchId, { title, sample, previous: last }).then(data => {
      previous.current = sample;
      if (alive.current) { setTrack(data); setError(''); }
    }).catch(e => {
      failed.current = true;
      if (alive.current) setError(e instanceof Error && e.message.includes('limit') ? e.message : 'Could not save captions. Check storage and try again. Replay the section to recapture captions missed during the error.');
    }).finally(() => { busy.current = false; if (alive.current) setSaving(false); });
  }, [watchId, title, time, text, connected, loaded, retry, saving]);
  const retrySaving = useCallback(() => { previous.current = undefined; setLoaded(false); failed.current = false; setRetry(v => v + 1); }, []);
  return { track, error, saving, loaded, retrySaving };
}
