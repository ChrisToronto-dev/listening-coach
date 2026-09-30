import { recordCaption, type CaptionSample, type CaptionTrack } from './netflix-captions';

// Local-only, scoped to this origin and browser profile. Transactions merge concurrent tabs.
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('listening-coach-netflix-captions', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'watchId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Close other learning-app tabs and try again.'));
  });
}

export async function captionTrack(watchId: string, observation?: { title: string; sample: CaptionSample; previous?: CaptionSample }): Promise<CaptionTrack> {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', observation ? 'readwrite' : 'readonly');
    const store = tx.objectStore('tracks'), request = store.get(watchId);
    let result: CaptionTrack, failure: unknown;
    request.onsuccess = () => {
      try {
        result = request.result ?? { watchId, title: observation?.title ?? '', cues: [], updatedAt: 0 };
        if (observation) {
          const cues = recordCaption(result.cues, observation.sample, observation.previous);
          result = { ...result, title: observation.title, cues, updatedAt: Date.now() };
          store.put(result);
        }
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure ?? tx.error ?? Error('Could not save captions.')); };
  });
}
