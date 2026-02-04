/**
 * Basic BOTCHA Tests
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { createChallenge, Verifier, getStore } = require('../src/index');

test('createChallenge generates valid math_speed challenge', () => {
  const challenge = createChallenge({ type: 'math_speed', difficulty: 'easy' });
  
  assert.ok(challenge.challenge_id, 'Should have challenge_id');
  assert.equal(challenge.type, 'math_speed');
  assert.equal(challenge.difficulty, 'easy');
  assert.equal(challenge.payload.equations.length, 10, 'Easy should have 10 problems');
  assert.equal(challenge.answers.length, 10, 'Should have 10 answers');
  assert.equal(challenge.ttl_ms, 2000, 'Easy should have 2000ms limit');
});

test('createChallenge generates valid json_extract challenge', () => {
  const challenge = createChallenge({ type: 'json_extract', difficulty: 'standard' });
  
  assert.ok(challenge.challenge_id);
  assert.equal(challenge.type, 'json_extract');
  assert.ok(challenge.payload.document, 'Should have document');
  assert.ok(challenge.payload.queries.length > 0, 'Should have queries');
});

test('createChallenge generates valid pattern_match challenge', () => {
  const challenge = createChallenge({ type: 'pattern_match', difficulty: 'standard' });
  
  assert.ok(challenge.challenge_id);
  assert.equal(challenge.type, 'pattern_match');
  assert.ok(challenge.payload.sequences.length > 0, 'Should have sequences');
});

test('Verifier accepts correct answers within time limit', () => {
  const store = getStore();
  const verifier = new Verifier({ store });
  
  const challenge = createChallenge({ type: 'math_speed', difficulty: 'easy' });
  store.set(challenge.challenge_id, challenge);
  
  // Solve correctly
  const answers = challenge.answers;
  const result = verifier.verify(challenge.challenge_id, answers);
  
  assert.equal(result.verified, true, 'Should be verified');
  assert.ok(result.token, 'Should have token');
  assert.ok(result.agent_score.solve_time_ms < 2000, 'Should be within time limit');
});

test('Verifier rejects incorrect answers', () => {
  const store = getStore();
  const verifier = new Verifier({ store });
  
  const challenge = createChallenge({ type: 'math_speed', difficulty: 'easy' });
  store.set(challenge.challenge_id, challenge);
  
  // Wrong answers
  const wrongAnswers = challenge.answers.map(() => 0);
  const result = verifier.verify(challenge.challenge_id, wrongAnswers);
  
  assert.equal(result.verified, false, 'Should not be verified');
  assert.equal(result.error, 'incorrect');
});

test('Verifier rejects invalid challenge_id', () => {
  const verifier = new Verifier();
  
  const result = verifier.verify('invalid-id', [1, 2, 3]);
  
  assert.equal(result.verified, false);
  assert.equal(result.error, 'invalid_challenge');
});

test('Token validation works', () => {
  const store = getStore();
  const verifier = new Verifier({ store, secret: 'test-secret' });
  
  const challenge = createChallenge({ type: 'math_speed', difficulty: 'easy' });
  store.set(challenge.challenge_id, challenge);
  
  const result = verifier.verify(challenge.challenge_id, challenge.answers);
  assert.ok(result.token);
  
  const validation = verifier.validateToken(result.token);
  assert.equal(validation.valid, true);
  assert.ok(validation.remaining_ms > 0);
});

console.log('Running BOTCHA tests...');
