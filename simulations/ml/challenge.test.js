import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChallengeDataset } from './challenge-dataset.js';
import { buildFeatureTable } from './feature-table.js';
import { evaluateChallenge } from './evaluate-challenge.js';

test('keeps challenge scenarios separate from training data and labels all challenge events', async () => {
  const challenge = generateChallengeDataset({ runs: 2 });
  assert.equal(challenge.events.length, challenge.labels.length);
  assert.ok(challenge.labels.some(label => label.scenario === 'challenge_low_slow_compromise' && label.label === 'successful_compromise'));
  const { rows } = buildFeatureTable(challenge.events, challenge.labels, { timeCutoff: '1900-01-01' });
  assert.ok(rows.every(row => row.split === 'test'));
  const report = await evaluateChallenge();
  assert.equal(report.purpose.startsWith('Out-of-distribution'), true);
  assert.ok(report.challenge_windows > 0);
});
