import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../dataset/generate.js';
import { buildFeatureTable, entityForEvent, toCsv } from './feature-table.js';

test('uses explicit known-user and unknown-user entities without coercing usernames', () => {
  assert.deepEqual(entityForEvent({ host: { id: 'h-1' }, source: { ip: '203.0.113.1' }, user: { name: 'alice' } }), { entity_type: 'known_user', host_id: 'h-1', source_ip: '203.0.113.1', user_name: 'alice' });
  assert.deepEqual(entityForEvent({ host: { id: 'h-1' }, source: { ip: '203.0.113.1' } }), { entity_type: 'unknown_user', host_id: 'h-1', source_ip: '203.0.113.1', user_name: null });
  assert.equal(entityForEvent({ host: { id: 'h-1' }, user: { name: 'alice' } }), null);
});

test('builds five-minute windows with external malicious labels and scenario-time splits', () => {
  const dataset = generateDataset({ seed: 3, hostCount: 3, normalSessionsPerHost: 2, attackRuns: 2 });
  const { rows, metadata } = buildFeatureTable(dataset.events, dataset.labels);
  assert.ok(rows.length > 0);
  assert.equal(metadata.skipped_event_count, 0);
  assert.ok(rows.every(row => row.window_start.endsWith(':00.000Z') && Number(row.window_start.slice(14, 16)) % 5 === 0));
  assert.ok(rows.some(row => row.label === 'malicious' && row.failed_login_count >= 10));
  assert.ok(rows.some(row => row.ground_truth_labels.includes('authorized_maintenance') && row.label === 'normal' && row.elevated_shell_count > 0));
  assert.ok(rows.some(row => row.split === 'train'));
  assert.ok(rows.some(row => row.split === 'test'));
  assert.match(toCsv(rows), /failed_login_count/);
});

test('requires an external label for every included event', () => {
  const event = { id: 'missing-label', timestamp: '2026-01-01T00:00:00.000Z', host: { id: 'h-1' }, source: { ip: '203.0.113.1' }, event: { category: 'authentication', action: 'login', result: 'failure' } };
  assert.throws(() => buildFeatureTable([event], []), /Missing external label/);
});
