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
  assert.equal(incident.detectionIds.length, 3);
  assert.deepEqual(incident.mitre, ['T1110', 'T1078', 'T1059.004']);
});

test('uses a distinct source-and-host rule when failed SSH logins have no username', () => {
  const events = Array.from({ length: 10 }, (_, index) => ({ id: `unknown-${index}`, timestamp: `2026-07-16T10:00:${String(index).padStart(2, '0')}Z`, host: { id: 'host-unknown' }, source: { ip: '198.51.100.77' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } }));
  const detections = detect(events);
  assert.equal(detections.filter(item => item.ruleId === 'NOLEN-SSH-003').length, 1);
  assert.equal(detections.some(item => item.ruleId === 'NOLEN-SSH-001'), false);
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
