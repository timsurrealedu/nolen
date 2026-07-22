import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRawTelemetry, createClickHouseTelemetryAuditor } from '../src/telemetry-audit.js';

const event = { nef_version: '1.0', id: 'audit-1', timestamp: '2026-01-01T00:00:00.000Z', host: { id: 'host-1' }, user: { name: 'alice' }, source: { ip: '203.0.113.1' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } };

test('profiles stored raw telemetry and reports ML entity gaps without modifying data', () => {
  const report = auditRawTelemetry([event, { ...event, id: 'audit-2', timestamp: '2026-01-01T00:01:00.000Z', event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 2, privilege: 'standard' }, source: undefined }], { now: '2026-02-01T00:00:00.000Z' });
  assert.equal(report.summary.status, 'ready_with_warnings');
  assert.equal(report.profile.canonical_entity_coverage, 0.5);
  assert.ok(report.findings.some(item => item.id === 'events_without_ml_entity'));
});

test('reads raw NEF through a bounded ClickHouse audit query', async () => {
  let request;
  const auditor = createClickHouseTelemetryAuditor({ query: async options => { request = options; return { json: async () => [{ raw_nef: JSON.stringify(event) }] }; } });
  const report = await auditor.audit({ limit: 12, now: '2026-02-01T00:00:00.000Z' });
  assert.equal(report.summary.status, 'healthy');
  assert.equal(request.query_params.limit, 12);
  await assert.rejects(() => auditor.audit({ limit: 0 }), RangeError);
});
