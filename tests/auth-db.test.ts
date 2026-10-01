import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken, getAppPassword } from '../lib/auth-token.ts';
import { insertLearnerIfMissing, getLearnerRecord, updateLearnerRecord, deleteLearnerRecord } from '../lib/db.ts';

test('auth token creation and verification', async () => {
  const token = await createSessionToken('test-user-1', 3600);
  assert.ok(token);

  const payload = await verifySessionToken(token);
  assert.ok(payload);
  assert.equal(payload.userId, 'test-user-1');
  assert.equal(payload.name, 'Learner');

  // Tampered token fails
  const tampered = token.slice(0, -4) + 'abcd';
  const invalid = await verifySessionToken(tampered);
  assert.equal(invalid, null);

  // Random string fails
  const garbage = await verifySessionToken('random-invalid-token');
  assert.equal(garbage, null);
});

test('default password configuration', () => {
  const pwd = getAppPassword();
  assert.ok(typeof pwd === 'string');
  assert.ok(pwd.length > 0);
});

test('universal database operations', async () => {
  const testId = 'test-db-user-' + Date.now();
  const initial = JSON.stringify({ version: 1, test: true });

  await insertLearnerIfMissing(testId, initial);
  const record = await getLearnerRecord(testId);
  assert.ok(record);
  assert.equal(record.revision, 0);
  assert.deepEqual(JSON.parse(record.data), { version: 1, test: true });

  // Update with revision
  const updated = JSON.stringify({ version: 2, test: true });
  const success = await updateLearnerRecord(testId, updated, 0);
  assert.equal(success, true);

  const reloaded = await getLearnerRecord(testId);
  assert.ok(reloaded);
  assert.equal(reloaded.revision, 1);
  assert.deepEqual(JSON.parse(reloaded.data), { version: 2, test: true });

  // Conflict on wrong revision
  const conflict = await updateLearnerRecord(testId, JSON.stringify({ version: 3 }), 0);
  assert.equal(conflict, false);

  // Clean up
  await deleteLearnerRecord(testId);
  const deleted = await getLearnerRecord(testId);
  assert.equal(deleted, null);
});
