import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript } from '../lib/youtube.ts';
import { currentSubtitles, rangeSubtitles, subtitleSelectionRange } from '../lib/timed-subtitles.ts';
const source = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nFirst line.\n\n00:00:02.500 --> 00:00:04.000\nSecond speaker.\n\n00:00:06.000 --> 00:00:08.000\nAfter a gap.';
test('local subtitles support simultaneous speakers while YouTube keeps its strict parser', () => {
  assert.throws(() => parseTranscript(source), /overlap/);
  const cues = parseTranscript(source, { allowOverlap: true });
  assert.equal(currentSubtitles(cues, 2.75).length, 2);
  assert.deepEqual(currentSubtitles(cues, 3).map(c => c.text), ['Second speaker.']);
  assert.deepEqual(currentSubtitles(cues, 4), []);
  assert.deepEqual(rangeSubtitles(cues, 3, 6).map(c => c.text), ['Second speaker.']);
});
test('selection spans all selected subtitles including gaps, overlaps and file offsets', () => {
  const cues = [{ start: 10, end: 20, text: 'Long speaker' }, { start: 12, end: 14, text: 'Short reply' }];
  assert.deepEqual(subtitleSelectionRange(cues), { start: 10, end: 20 });
  assert.deepEqual(subtitleSelectionRange([cues[1], cues[0]], 3), { start: 13, end: 23 });
  assert.deepEqual(subtitleSelectionRange([{ start: 1, end: 3, text: 'First' }, { start: 20, end: 25, text: 'Last' }], -2), { start: 0, end: 23 });
  assert.equal(subtitleSelectionRange(cues, -25), null);
  assert.equal(subtitleSelectionRange([]), null);
});
test('subtitle offsets shift both the current sentence and selected range', () => {
  const cues = parseTranscript(source, { allowOverlap: true });
  assert.deepEqual(currentSubtitles(cues, 1, 2), []);
  assert.equal(currentSubtitles(cues, 3, 2)[0].text, 'First line.');
  assert.equal(currentSubtitles(cues, 0, -1)[0].text, 'First line.');
  assert.deepEqual(rangeSubtitles(cues, 8, 10, 2).map(c => c.text), ['After a gap.']);
  assert.deepEqual(currentSubtitles(cues, NaN), []);
  assert.deepEqual(rangeSubtitles(cues, 8, 1), []);
});
