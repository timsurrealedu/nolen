import test from 'node:test';
import assert from 'node:assert/strict';
import { correlate, detect } from '../src/engine.js';
import { sshCompromiseEvents } from '../../../simulations/ssh-compromise/fixture.js';

test('creates the required rules, sequence, and SSH compromise incident', () => {
  const detections = detect(sshCompromiseEvents());
  assert.deepEqual(new Set(detections.map(item => item.ruleId)), new Set(['NOLEN-SSH-001', 'NOLEN-PROC-001', 'NOLEN-SEQ-001']));
  const [incident] = correlate(detections);
  assert.equal(incident.title, 'Probable SSH Account Compromise');
  assert.equal(incident.confidence, 80);
  assert.equal(incident.entities.hostId, 'host-1');
  assert.equal(incident.entities.user, 'deploy');
  assert.deepEqual(incident.mitre, ['T1110', 'T1078', 'T1059.004']);
});

test('deduplicates event IDs before count windows', () => {
  const failures = sshCompromiseEvents().filter(event => event.event.result === 'failure');
  assert.equal(detect([...failures.slice(0, 9), ...failures.slice(0, 9)]).filter(item => item.ruleId === 'NOLEN-SSH-001').length, 0);
});

test('does not correlate a privileged shell for a different user', () => {
  const events = sshCompromiseEvents();
  events.at(-1).user = { name: 'root' };
  assert.equal(correlate(detect(events)).length, 0);

});
