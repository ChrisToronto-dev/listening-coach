import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restorePracticeSelection } from '../lib/practice-selection.ts';
import { videoView, type VideoStudy } from '../lib/youtube.ts';

function fixture(): VideoStudy {
  return { id:'test',videoId:'MxkVneD7-HY',url:'https://youtu.be/MxkVneD7-HY',title:'Test',createdAt:'2026-10-01',updatedAt:'2026-10-01',cues:[{start:0,end:6,text:'First sentence. Second sentence.'},{start:6,end:9,text:'Third sentence.'}],rightsBasis:'test',notes:'',start:0,end:6,attempts:{},revealed:[],shadowed:[],selectedCue:0 };
}

test('sentence selection restores only that sentence even when it shares a raw caption',()=>{
  const video=fixture(),sentences=videoView(video).transcriptCues;
  video.selectedSentence=1;video.start=sentences[1].start;video.end=sentences[1].end;
  assert.deepEqual(restorePracticeSelection(videoView(video)),{indexes:[0],sentenceIndexes:[1]});
});
test('saved sentence group wins over identical raw cue timing, preserving its answer key',()=>{
  const video=fixture();video.selectedSentences=[0,1];
  assert.deepEqual(restorePracticeSelection(videoView(video)),{indexes:[0],sentenceIndexes:[0,1]});
});
test('saved checkbox selection restores only the checked sentences when they are separated',()=>{
  const video=fixture(),sentences=videoView(video).transcriptCues;
  video.selectedSentences=[0,2];video.start=sentences[0].start;video.end=sentences[2].end;
  assert.deepEqual(restorePracticeSelection(videoView(video)),{indexes:[0,1],sentenceIndexes:[0,2]});
});
test('legacy single-caption practice retains its original answer scope',()=>{
  assert.deepEqual(restorePracticeSelection(videoView(fixture())),{indexes:[0],sentenceIndexes:null});
});
test('legacy range spanning captions restores a matching sentence group',()=>{
  const video=fixture();video.end=9;
  assert.deepEqual(restorePracticeSelection(videoView(video)),{indexes:[0],sentenceIndexes:[0,1,2]});
});
test('empty captions and stale range metadata do not create invalid selections',()=>{
  const video=fixture();video.selectedSentences=[99];
  assert.deepEqual(restorePracticeSelection(videoView(video)),{indexes:[0],sentenceIndexes:null});
  video.cues=[];
  assert.deepEqual(restorePracticeSelection(videoView(video)),{indexes:[],sentenceIndexes:null});
});
