import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../dataset/generate.js';
import { assessDataQuality } from './data-quality.js';

test('marks the generated dataset ready for offline ML and profiles the feature table', () => {
  const dataset = generateDataset({ seed: 15, hostCount: 3, normalSessionsPerHost: 2, attackRuns: 2 });
  const report = assessDataQuality(dataset.events, dataset.labels, { now: '2026-02-01T00:00:00.000Z' });
  assert.equal(report.summary.status, 'ready_for_offline_ml');
  assert.equal(report.summary.event_count, dataset.events.length);
  assert.ok(report.profile.ml_feature_rows > 0);
  assert.equal(report.findings.some(finding => finding.severity === 'critical'), false);
});

test('blocks invalid, duplicate, and unlabelled event data instead of hiding it', () => {
  const event = { nef_version: '1.0', id: 'event-1', timestamp: '2026-01-01T00:00:00.000Z', host: { id: 'host-1' }, source: { ip: '203.0.113.1' }, event: { category: 'authentication', action: 'login', result: 'failure' }, service: { name: 'ssh' } };
  const report = assessDataQuality([event, { ...event, timestamp: 'not-a-time' }], [], { now: '2026-02-01T00:00:00.000Z' });
  assert.equal(report.summary.status, 'blocked');
  assert.ok(report.findings.some(finding => finding.id === 'invalid_nef'));
  assert.ok(report.findings.some(finding => finding.id === 'duplicate_event_ids'));
  assert.ok(report.findings.some(finding => finding.id === 'missing_external_labels'));
});

test('reports valid telemetry that cannot form a canonical ML entity', () => {
  const event = { nef_version: '1.0', id: 'process-1', timestamp: '2026-01-01T00:00:00.000Z', host: { id: 'host-1' }, user: { name: 'alice' }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 1, privilege: 'standard' } };
  const report = assessDataQuality([event], [{ event_id: 'process-1', scenario: 'normal', label: 'normal', is_malicious: 'false' }], { now: '2026-02-01T00:00:00.000Z' });
  assert.equal(report.summary.status, 'ready_with_warnings');
  assert.ok(report.findings.some(finding => finding.id === 'events_without_ml_entity'));
});
