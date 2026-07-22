import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresIncidentRepository } from '../src/incidents.js';

const incident = { id: 'incident-1', createdAt: '2026-07-22T00:00:00.000Z', severity: 'high', status: 'open' };

test('persists incidents idempotently with parameterized SQL', async () => {
  const calls = [], repository = createPostgresIncidentRepository({ query: async (...args) => { calls.push(args); return { rowCount: 1 }; } });
  assert.deepEqual(await repository.persist(incident), { stored: true, duplicate: false });
  assert.deepEqual(calls[0][1], [incident.id, incident.createdAt, incident.severity, incident.status, incident]);
  assert.match(calls[0][0], /ON CONFLICT DO NOTHING/);
});

test('lists bounded newest incidents', async () => {
  const repository = createPostgresIncidentRepository({ query: async () => ({ rows: [{ body: incident }] }) });
  assert.deepEqual(await repository.list({ limit: 20 }), [incident]);
  await assert.rejects(repository.list({ limit: 0 }), RangeError);
  await assert.rejects(repository.list({ limit: 1001 }), RangeError);
});

test('updates incident status and returns the audited previous status', async () => {
  let parameters;
  const repository = createPostgresIncidentRepository({ query: async (query, values) => { parameters = values; assert.match(query, /incident_status_audit/); return { rows: [{ body: { ...incident, status: 'resolved' }, previous_status: 'open' }] }; } });
  assert.deepEqual(await repository.updateStatus('incident-1', 'resolved', 'admin'), { ...incident, status: 'resolved', previousStatus: 'open' });
  assert.deepEqual(parameters, ['incident-1', 'resolved', 'admin']);
});
