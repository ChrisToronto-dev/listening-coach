import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attemptKey, sentenceAttemptKey, parseYouTubeUrl, parseTranscript, videoView, validRange, boundaryAction, type VideoStudy } from '../lib/youtube.ts';
test('sentence attempt keys distinguish different sparse checkbox selections',()=>{
 assert.equal(sentenceAttemptKey([2,3]),'sentence:2-3');
 assert.equal(sentenceAttemptKey([2,5]),'sentence-set:2,5');
 assert.notEqual(sentenceAttemptKey([2,5]),sentenceAttemptKey([2,7]));
});
test('YouTube links normalize watch/short/share/embed formats and timestamps',()=>{
 for(const url of ['https://www.youtube.com/watch?v=MxkVneD7-HY&list=test','https://youtu.be/MxkVneD7-HY','https://m.youtube.com/shorts/MxkVneD7-HY','https://www.youtube.com/embed/MxkVneD7-HY'])assert.equal(parseYouTubeUrl(url).videoId,'MxkVneD7-HY');
 assert.equal(parseYouTubeUrl('https://youtu.be/MxkVneD7-HY?t=1m23s').start,83);
 for(const url of ['https://youtube.com.evil.test/watch?v=MxkVneD7-HY','javascript:alert(1)','https://youtube.com/playlist?list=a','https://youtu.be/invalid','https://x@youtube.com/watch?v=MxkVneD7-HY'])assert.throws(()=>parseYouTubeUrl(url));
});
test('VTT and SRT parse multiline text, IDs, CRLF and timing settings',()=>{
 assert.deepEqual(parseTranscript('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.250 align:start\nHello,\nworld!'),[{start:1,end:3.25,text:'Hello, world!'}]);
 assert.deepEqual(parseTranscript('1\r\n00:00:04,500 --> 00:00:07,000\r\nA new sentence.'),[{start:4.5,end:7,text:'A new sentence.'}]);
 assert.equal(parseTranscript('WEBVTT\n\nNOTE local fixture\n\n00:01.000 --> 00:03.000\n<b>Test</b> &amp; text')[0].text,'Test & text');
});
test('invalid cues fail before any transcript mutation',()=>{
 for(const text of ['','hello','00:04.000 --> 00:03.000\ntext','00:01.000 --> 00:02.000\n','00:01.000 --> 00:04.000\nA\n\n00:03.000 --> 00:05.000\nB','00:60.000 --> 01:02.000\nA'])assert.throws(()=>parseTranscript(text));
});
test('private cue answers only appear after reveal or first submission',()=>{
 const v:VideoStudy={id:'test',videoId:'MxkVneD7-HY',url:'https://www.youtube.com/watch?v=MxkVneD7-HY',title:'Test',createdAt:'2026-09-23',updatedAt:'2026-09-23',cues:[{start:0,end:3,text:'secret target'}],rightsBasis:'self-authored test',notes:'',start:0,end:3,attempts:{},revealed:[],shadowed:[],selectedCue:0};
 assert.equal(videoView(v).cues[0].text,undefined);
 v.revealed.push(0);assert.equal(videoView(v).cues[0].text,'secret target');
 v.revealed=[];v.attempts[0]={answer:'secret',accuracy:50,captions:false,createdAt:'2026-09-23'};assert.equal(videoView(v).cues[0].text,'secret target');
});
test('one attempt can grade and reveal a contiguous group of captions',()=>{
 const v:VideoStudy={id:'test',videoId:'MxkVneD7-HY',url:'https://www.youtube.com/watch?v=MxkVneD7-HY',title:'Test',createdAt:'2026-09-23',updatedAt:'2026-09-23',cues:[{start:0,end:3,text:'first sentence'},{start:3,end:6,text:'second sentence'}],rightsBasis:'self-authored test',notes:'',start:0,end:6,attempts:{},revealed:[],shadowed:[],selectedCue:0};
 const indexes=[0,1],key=attemptKey(indexes);
 assert.equal(key,'range:0-1');
 v.attempts[key]={answer:'first sentence second sentence',accuracy:100,captions:false,createdAt:'2026-09-23',indexes};
 assert.deepEqual(videoView(v).cues.map(c=>c.text),['first sentence','second sentence']);
});
test('saved YouTube captions get sentence boundaries without exposing unanswered text',()=>{
 const v:VideoStudy={id:'test',videoId:'MxkVneD7-HY',url:'https://www.youtube.com/watch?v=MxkVneD7-HY',title:'Test',createdAt:'2026-09-23',updatedAt:'2026-09-23',cues:[{start:0,end:4,text:'First sentence. Second'},{start:4,end:7,text:'sentence ends.'}],rightsBasis:'self-authored test',notes:'',start:0,end:7,attempts:{},revealed:[],shadowed:[],selectedCue:0};
 const hidden=videoView(v).transcriptCues;
 assert.deepEqual(hidden.map(c=>c.text),[undefined,undefined]);
 assert.deepEqual(hidden.map(c=>[c.firstIndex,c.lastIndex]),[[0,0],[0,1]]);
 v.revealed=[0,1];
 assert.deepEqual(videoView(v).transcriptCues.map(c=>c.text),['First sentence.','Second sentence ends.']);
});
test('range control only acts at the end during actual playback',()=>{
 assert.equal(validRange(2,2),false);assert.equal(validRange(-1,5),false);assert.equal(validRange(2,5),true);
 assert.equal(boundaryAction(5,2,5,true,1),'restart');assert.equal(boundaryAction(5,2,5,false,1),'none');
 assert.equal(boundaryAction(5,2,5,true,2),'none');assert.equal(boundaryAction(5,2,5,true,3),'none');assert.equal(boundaryAction(3,2,5,true,1),'none');
});
