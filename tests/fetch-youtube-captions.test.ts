import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptionImportError, fetchYouTubeCaptions } from '../lib/fetch-youtube-captions.ts';

const videoId = 'MxkVneD7-HY', origin = 'https://coach.example';
const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there.';

test('hosted import calls the Python function, forwards auth and preserves caption timing', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(String(url), origin + '/api/youtube-captions');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store');
    assert.equal(new Headers(options?.headers).get('cookie'), 'lc_session=test');
    assert.equal(new Headers(options?.headers).get('origin'), origin);
    assert.deepEqual(JSON.parse(String(options?.body)), { videoId });
    return Response.json({ vtt, automatic: false, language: 'en' });
  };
  assert.deepEqual(await fetchYouTubeCaptions(videoId, origin, 'lc_session=test', fetcher), {
    cues: [{ start: 1, end: 3, text: 'Hello there.' }], automatic: false, language: 'en',
  });
});
test('invalid IDs are rejected before any network request', async () => {
  await assert.rejects(fetchYouTubeCaptions('https://attacker.example', origin, '', async () => { assert.fail('must not fetch'); }), /Invalid YouTube/);
});
test('missing Python function produces a useful deployment error instead of parsing HTML as JSON', async () => {
  await assert.rejects(fetchYouTubeCaptions(videoId, origin, '', async () => new Response('<html>404</html>', { status: 404 })), error => error instanceof CaptionImportError && error.status === 503);
});
test('rate limits, unavailable captions and expired auth are reported specifically', async () => {
  for (const [code, status, pattern, expected] of [
    ['RATE_LIMITED', 429, /temporarily limited/, 429],
    ['NO_ENGLISH_CAPTIONS', 422, /No English captions/, 422],
    ['LOGIN_REQUIRED', 422, /verification/, 422],
    ['AUTH', 401, /Sign in again/, 401],
  ] as const) {
    await assert.rejects(fetchYouTubeCaptions(videoId, origin, '', async () => Response.json({ error: code }, { status })), error => error instanceof CaptionImportError && error.status === expected && pattern.test(error.message));
  }
});
test('invalid data and unreachable caption service fail without modifying captions', async () => {
  await assert.rejects(fetchYouTubeCaptions(videoId, origin, '', async () => Response.json({ vtt, automatic: 'yes', language: 'en' })), /invalid data/);
  await assert.rejects(fetchYouTubeCaptions(videoId, origin, '', async () => { throw new TypeError('fetch failed'); }), error => error instanceof CaptionImportError && error.status === 502);
});
