import { getCurrentUser } from './auth';
import { freshState, type State } from './core';
import { getLearnerRecord, insertLearnerIfMissing, updateLearnerRecord, deleteLearnerRecord } from './db';

export async function loadLearner() {
  const user = await getCurrentUser();
  if (!user) throw new Error('AUTH');

  await insertLearnerIfMissing(user.userId, JSON.stringify(freshState()));
  const record = await getLearnerRecord(user.userId);
  if (!record) throw new Error('Could not load learner record.');

  const state = JSON.parse(record.data) as State;
  state.videos ??= [];
  state.netflixClips ??= [];
  return { id: user.userId, state, revision: record.revision };
}

export async function saveLearner(record: { id: string; state: State; revision: number }) {
  const success = await updateLearnerRecord(record.id, JSON.stringify(record.state), record.revision);
  if (!success) throw new Error('CONFLICT');
}

export async function resetLearner(id: string) {
  await deleteLearnerRecord(id);
}
