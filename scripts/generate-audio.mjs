import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const content=readFileSync('lib/content.ts','utf8');const blocks=[...content.matchAll(/sentences:\[(.*?)\],first:/gs)].map(m=>JSON.parse('['+m[1]+']'));
for(let l=0;l<blocks.length;l++){for(const [id,text] of [...blocks[l].map((text,i)=>[i,text]),['full',blocks[l].join(' ')]] ){const file=`/tmp/listening-coach-${l}-${id}`;writeFileSync(file+'.txt',text);execFileSync('/usr/bin/say',['-v','Samantha','-r','145','-f',file+'.txt','-o',file+'.aiff']);execFileSync('/usr/bin/afconvert',['-f','WAVE','-d','LEI16',file+'.aiff',`public/audio/${l}-${id}.wav`]);unlinkSync(file+'.aiff');unlinkSync(file+'.txt')}}
