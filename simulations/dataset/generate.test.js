import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent } from '../../packages/nef/src/validate.js';
import { generateDataset } from './generate.js';

test('generates deterministic, valid, externally labelled NEF data', () => {
  const first = generateDataset({ seed: 42, hostCount: 3, normalSessionsPerHost: 2, attackRuns: 2 });
  const second = generateDataset({ seed: 42, hostCount: 3, normalSessionsPerHost: 2, attackRuns: 2 });
  assert.deepEqual(first, second);
  assert.ok(first.events.length > 0);
  assert.equal(first.labels.length, first.events.length);
  assert.equal(new Set(first.events.map(event => event.id)).size, first.events.length);
  assert.deepEqual(first.events.flatMap(event => validateEvent(event).errors), []);
  assert.equal(first.events.some(event => 'label' in event || 'is_malicious' in event), false);
  assert.deepEqual(new Set(first.metadata.scenarios), new Set(['normal_operations', 'benign_login_retries', 'ssh_brute_force', 'invalid_user_enumeration', 'authorized_maintenance', 'ssh_compromise']));
});

test('keeps authorized maintenance normal while compromise windows contain malicious labels', () => {
  const { labels } = generateDataset({ seed: 9, hostCount: 2, normalSessionsPerHost: 1, attackRuns: 1 });
  assert.ok(labels.filter(label => label.scenario === 'authorized_maintenance').every(label => label.is_malicious === 'false'));
  assert.ok(labels.some(label => label.scenario === 'ssh_compromise' && label.label === 'successful_compromise' && label.is_malicious === 'true'));
});
