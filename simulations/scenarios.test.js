import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSecurityScenarios } from './run.js';
import { securityScenarios } from './scenarios.js';

test('all offline security scenarios match their expected detections and incidents', () => {
  const results = evaluateSecurityScenarios();
  assert.deepEqual(results.filter(result => !result.passed), []);
  assert.deepEqual(results.find(result => result.id === 'ssh_compromise').incidents, [{ title: 'Probable SSH Account Compromise', confidence: 80, detectionCount: 3, evidenceCount: 12 }]);
});

test('every simulated event has an external ground-truth label', () => {
  const labelIds = readFileSync(new URL('./labels.csv', import.meta.url), 'utf8').trim().split('\n').slice(1).map(line => line.split(',')[0]);
  const eventIds = [...new Set(securityScenarios().flatMap(scenario => scenario.events).map(event => event.id))];
  assert.equal(new Set(labelIds).size, labelIds.length);
  assert.deepEqual(labelIds.sort(), eventIds.sort());
});
