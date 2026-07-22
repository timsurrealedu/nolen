import test from 'node:test';
import assert from 'node:assert/strict';
import { correlate, detect } from '../src/engine.js';
import { sshCompromiseEvents } from '../../../simulations/ssh-compromise/fixture.js';
import { loadRules } from '../../../packages/rule-parser/src/load.js';

test('creates the required rules, sequence, and SSH compromise incident', () => {
  const detections = detect(sshCompromiseEvents());
  assert.deepEqual(new Set(detections.map(item => item.ruleId)), new Set(['NOLEN-SSH-001', 'NOLEN-PROC-001', 'NOLEN-SEQ-001']));
  const [incident] = correlate(detections);
  assert.equal(incident.title, 'Probable SSH Account Compromise');
  assert.equal(incident.confidence, 80);
  assert.equal(incident.entities.hostId, 'host-1');
  assert.equal(incident.entities.user, 'deploy');
  assert.deepEqual(incident.detectionIds.map(id => id.split(':')[0]), ['NOLEN-SSH-001', 'NOLEN-SEQ-001', 'NOLEN-PROC-001']);
  assert.deepEqual(incident.mitre, ['T1110', 'T1078', 'T1059.004']);
});

test('uses repository YAML metadata and thresholds', () => {
  const rules = loadRules();
  const rule = rules.get('NOLEN-SSH-001');
  const events = sshCompromiseEvents().filter(event => event.event.result === 'failure');
  assert.equal(rule.condition.count, 10);
  rule.condition.count = 11;
  assert.equal(detect(events, { rules }).some(item => item.ruleId === rule.id), false);
  rule.condition.count = 10;
  rule.name = 'Rule name loaded from YAML';
  assert.equal(detect(events, { rules }).find(item => item.ruleId === rule.id).title, rule.name);
});

test('keeps invalid-user enumeration unmapped in the MVP', () => {
  const events = Array.from({ length: 5 }, (_, index) => ({ id: `invalid-${index}`, timestamp: `2026-07-16T10:00:0${index}Z`, host: { id: 'host-1' }, source: { ip: '198.51.100.44' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'invalid_user', result: 'failure' } }));
  const [detection] = detect(events);
  assert.equal(detection.ruleId, 'NOLEN-SSH-002');
  assert.deepEqual(detection.mitre, []);
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

test('keeps a qualifying count window when later events fall outside it', () => {
  const failures = sshCompromiseEvents().filter(event => event.event.result === 'failure');
  const late = { ...failures.at(-1), id: 'fail-late', timestamp: '2026-07-15T14:35:00Z' };
  assert.equal(detect([...failures, late]).filter(item => item.ruleId === 'NOLEN-SSH-001').length, 1);
});

test('does not combine entities or events outside the count window', () => {
  const failures = sshCompromiseEvents().filter(event => event.event.result === 'failure');
  const splitSources = failures.map((event, index) => ({ ...event, source: { ip: index < 5 ? '198.51.100.1' : '198.51.100.2' } }));
  const slow = failures.map((event, index) => ({ ...event, timestamp: new Date(Date.parse(failures[0].timestamp) + index * 7_000).toISOString() }));
  assert.equal(detect(splitSources).some(item => item.ruleId === 'NOLEN-SSH-001'), false);
  assert.equal(detect(slow).some(item => item.ruleId === 'NOLEN-SSH-001'), false);
});

test('enforces sensitive-file action policy and ignores elevated non-shells', () => {
  const common = { nef_version: '1.0', timestamp: '2026-07-15T14:32:00Z', host: { id: 'host-1' }, user: { name: 'deploy' } };
  const events = [
    { ...common, id: 'passwd', event: { category: 'file', action: 'access' }, file: { path: '/etc/passwd' } },
    { ...common, id: 'cron-read', event: { category: 'file', action: 'access' }, file: { path: '/etc/cron.d/backup' } },
    { ...common, id: 'cron-write', event: { category: 'file', action: 'modify' }, file: { path: '/etc/cron.d/backup' } },
    { ...common, id: 'shadow', event: { category: 'file', action: 'access' }, file: { path: '/etc/shadow' } },
    { ...common, id: 'sudo', event: { category: 'process', action: 'start' }, process: { name: 'sudo', privilege: 'elevated' } }
  ];
  const detections = detect(events);
  assert.deepEqual(detections.filter(item => item.ruleId === 'NOLEN-FILE-001').map(item => item.evidenceEventIds[0]), ['cron-write', 'shadow']);
  assert.equal(detections.some(item => item.ruleId === 'NOLEN-PROC-001'), false);
});

test('does not correlate a privileged shell for a different user', () => {
  const events = sshCompromiseEvents();
  events.at(-1).user = { name: 'root' };
  assert.equal(correlate(detect(events)).length, 0);
});

test('does not correlate privileged activity before the successful login', () => {
  const events = sshCompromiseEvents();
  events.at(-1).timestamp = '2026-07-15T14:32:24Z';
  assert.equal(correlate(detect(events)).length, 0);
});

test('requires the sequence source and five-minute correlation window', () => {
  const wrongSource = sshCompromiseEvents();
  wrongSource.at(-2).source = { ip: '203.0.113.10' };
  assert.equal(correlate(detect(wrongSource)).length, 0);

  const lateShell = sshCompromiseEvents();
  lateShell.at(-1).timestamp = '2026-07-15T14:37:26Z';
  assert.equal(correlate(detect(lateShell)).length, 0);
});
