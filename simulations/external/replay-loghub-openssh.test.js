import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOpenSshReplay } from './replay-loghub-openssh.js';

test('replays external SSH events through deterministic detection without training', () => {
  const events = Array.from({ length: 10 }, (_, index) => ({
    nef_version: '1.0', id: `external-${index}`, timestamp: `2017-12-10T06:55:${String(index).padStart(2, '0')}.000Z`, host: { id: 'loghub:LabSZ' }, user: { name: 'admin' }, source: { ip: '203.0.113.10' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' }
  }));
  const report = summarizeOpenSshReplay(events);
  assert.equal(report.purpose.includes('not ML training'), true);
  assert.equal(report.detection_count_by_rule['NOLEN-SSH-001'], 1);
  assert.equal(report.incident_count, 0);
});
