import test from 'node:test';
import assert from 'node:assert/strict';
import { recordCaption } from '../lib/netflix-captions.ts';
import { currentSubtitles } from '../lib/timed-subtitles.ts';

test('observed subtitles extend while playing, deduplicate while paused and on replay', () => {
  let cues = recordCaption([], { time: 10, text: 'First sentence.' });
  cues = recordCaption(cues, { time: 10.5, text: 'First sentence.' }, { time: 10, text: 'First sentence.' });
  assert.deepEqual(cues, [{ start: 10, end: 11, text: 'First sentence.' }]);
  cues = recordCaption(cues, { time: 10.5, text: 'First sentence.' }, { time: 10.5, text: 'First sentence.' });
  cues = recordCaption(cues, { time: 10, text: 'First sentence.' }, { time: 10.5, text: 'First sentence.' });
  assert.deepEqual(cues, [{ start: 10, end: 11, text: 'First sentence.' }]);
  assert.equal(currentSubtitles(cues, 10.5)[0].text, 'First sentence.');
});
test('seeks and repeated dialogue at different times do not invent long caption intervals', () => {
  const first = { time: 10, text: 'Yes.' }, later = { time: 60, text: 'Yes.' };
  let cues = recordCaption([], first);
  cues = recordCaption(cues, later, first);
  assert.equal(cues.length, 2);
  assert.deepEqual(currentSubtitles(cues, 30), []);
  cues = recordCaption(cues, { time: 3, text: 'Earlier.' }, later);
  assert.deepEqual(cues.map(c => c.start), [3, 10, 60]);
});
test('caption changes and empty samples close the prior line without recording blanks', () => {
  const first = { time: 10, text: 'First.' };
  let cues = recordCaption([], first);
  cues = recordCaption(cues, { time: 10.3, text: 'Second.' }, first);
  assert.deepEqual(currentSubtitles(cues, 10.3).map(c => c.text), ['Second.']);
  cues = recordCaption(cues, { time: 10.6, text: '' }, { time: 10.3, text: 'Second.' });
  assert.deepEqual(currentSubtitles(cues, 10.6), []);
  assert.equal(cues.length, 2);
  assert.deepEqual(recordCaption(cues, { time: NaN, text: 'Invalid' }), cues);
});
test('turning CC off during a replay preserves previously recorded longer intervals', () => {
  const saved = [{ start: 10, end: 20, text: 'Already recorded.' }];
  const replay = recordCaption(saved, { time: 12.3, text: '' }, { time: 12, text: 'Already recorded.' });
  assert.deepEqual(replay, saved);
  assert.equal(currentSubtitles(replay, 17)[0].text, 'Already recorded.');
});
test('recapturing a line break repairs legacy concatenated text only at the same interval', () => {
  const oldText = "Why don't you tell heryou can't drive her today,", text = "Why don't you tell her\nyou can't drive her today,";
  const cues = [{ start: 10, end: 15, text: oldText }, { start: 40, end: 45, text: oldText }];
  assert.deepEqual(recordCaption(cues, { time: 11, text }), [{ start: 10, end: 15, text }, cues[1]]);
  assert.equal(recordCaption([{ start: 10, end: 15, text: 'A different line.' }], { time: 11, text }).length, 2);
});
