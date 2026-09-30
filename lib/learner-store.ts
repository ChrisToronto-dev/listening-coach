import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { freshState, type State } from './core';
export async function loadLearner() {
  const user=await getChatGPTUser();
  if(!user)throw new Error('AUTH');
  if(!env.DB)throw new Error('Could not connect to the learning store.');
  await env.DB.prepare('INSERT OR IGNORE INTO learners (id,data,revision) VALUES (?, ?, 0)').bind(user.userId,JSON.stringify(freshState())).run();
  const row=await env.DB.prepare('SELECT data,revision FROM learners WHERE id=?').bind(user.userId).first<{data:string;revision:number}>();
  const state=JSON.parse(row!.data) as State;
  state.videos??=[];
  return {id:user.userId,state,revision:row!.revision,db:env.DB};
}
export async function saveLearner(record:Awaited<ReturnType<typeof loadLearner>>) {
  const result=await record.db.prepare('UPDATE learners SET data=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(record.state),record.id,record.revision).run();
  if(!result.meta.changes)throw new Error('CONFLICT');
}
