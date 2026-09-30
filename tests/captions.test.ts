import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeYouTubeCaptions,captionsToVtt} from '../lib/captions.ts';
import {parseTranscript,timeParts,secondsFromParts} from '../lib/youtube.ts';
import {groupSentenceCues} from '../lib/sentence-cues.ts';
test('rolling captions remove repeated text without duplicating transition cues',()=>{
 const input='WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nHello there\n\n00:00:03.000 --> 00:00:03.010\nHello there\n\n00:00:03.010 --> 00:00:06.000\nHello there\nmy friend.';
 const cues=normalizeYouTubeCaptions(input);assert.equal(cues.map(c=>c.text).join(' '),'Hello there my friend.');assert.ok(cues.every(c=>c.end>c.start));assert.deepEqual(parseTranscript(captionsToVtt(cues)),cues);
});
test('explicitly separated repeats are retained and manual sentences unchanged',()=>{
 const cues=normalizeYouTubeCaptions('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello!\n\n00:00:05.000 --> 00:00:07.000\nHello!');assert.equal(cues.length,2);assert.equal(cues[1].start,5);
});
test('hour minute second conversion preserves fractional cue boundaries',()=>{
 assert.deepEqual(timeParts(3723.456),{hours:1,minutes:2,seconds:3.456});assert.equal(secondsFromParts({hours:1,minutes:2,seconds:3.456}),3723.456);assert.deepEqual(timeParts(59.9996),{hours:0,minutes:1,seconds:0});assert.equal(secondsFromParts(timeParts(1099.2)),1099.2);
});
test('blank automatic CC transitions are ignored',()=>{const cues=normalizeYouTubeCaptions('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n<c></c>\n\n00:00:01.000 --> 00:00:03.000\nA real caption.');assert.equal(cues.length,1);assert.equal(cues[0].start,1);});
test('caption display joins lines at sentence punctuation and splits multiple sentences in one cue',()=>{
 const cues=groupSentenceCues([
  {start:13,end:20,text:'than everybody else. If you think that silence means insecurity, you should think again. The people who stay off of'},
  {start:20,end:27,text:"the feeds, they're often the most self-assured. They're not afraid to be seen, they've just outgrown the need to"},
  {start:27,end:33,text:"be seen. And there's a couple different reasons why that is."},
 ]);
 assert.deepEqual(cues.map(c=>c.text),[
  'than everybody else.',
  'If you think that silence means insecurity, you should think again.',
  "The people who stay off of the feeds, they're often the most self-assured.",
  "They're not afraid to be seen, they've just outgrown the need to be seen.",
  "And there's a couple different reasons why that is.",
 ]);
 assert.ok(cues.every((cue,i)=>cue.end>cue.start&&(i===0||cue.start>=cues[i-1].end)));
});
test('punctuation-free captions stop joining after a pause and hidden captions keep their positions',()=>{
 const cues=groupSentenceCues([{start:0,end:2,text:'A sentence without punctuation'},{start:5,end:7,text:'A new thought.'},{start:8,end:10}]);
 assert.deepEqual(cues.map(c=>c.text),['A sentence without punctuation','A new thought.','']);
 assert.deepEqual(cues.map(c=>c.firstIndex),[0,1,2]);
});
test('sentence grouping keeps abbreviations and handles captions without a space after punctuation',()=>{
 const cues=groupSentenceCues([{start:0,end:8,text:'Dr. Lee arrived.She said hello!'}]);
 assert.deepEqual(cues.map(c=>c.text),['Dr. Lee arrived.','She said hello!']);
});
