import {test} from 'node:test';
import assert from 'node:assert/strict';
import {score,localDate,nextDate,nextInterval,normalize,practiceSeconds} from '../lib/core.ts';
test('dictation normalizes case punctuation and supported contractions',()=>{assert.equal(score("I'd give it a shot!",'I would give it a shot.'),100);assert.equal(score('', 'one two'),0);assert.equal(score('one extra two','one two'),50);assert.deepEqual(normalize("I’m ready."),['i','am','ready'])});
test('Toronto local calendar respects DST transition',()=>{assert.equal(localDate('America/Toronto',new Date('2026-03-08T04:59:00Z')),'2026-03-07');assert.equal(localDate('America/Toronto',new Date('2026-03-08T07:00:00Z')),'2026-03-08');assert.equal(localDate('America/Toronto',new Date('2026-11-01T05:30:00Z')),'2026-11-01')});
test('spaced repetition uses calendar dates across month and year boundaries',()=>{assert.equal(nextDate('2026-12-31',1),'2027-01-01');assert.equal(nextDate('2026-03-07',3),'2026-03-10');assert.equal(nextInterval(1,true),3);assert.equal(nextInterval(14,true),30);assert.equal(nextInterval(30,true),30);assert.equal(nextInterval(30,false),1)});
test('media practice totals YouTube and Netflix time while tolerating legacy data',()=>{assert.equal(practiceSeconds(),0);assert.equal(practiceSeconds({youtubeSeconds:75}),75);assert.equal(practiceSeconds({youtubeSeconds:75,netflixSeconds:45}),120)});
