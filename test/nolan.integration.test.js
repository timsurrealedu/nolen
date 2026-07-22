import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NolenAgent } from '../agent/src/client.js';
import { createApplicationServer } from '../apps/api/src/server.js';
import { createIngestionServer } from '../apps/ingestion/src/server.js';

const event = { nef_version: '1.0', id: 'evt-agent-1', timestamp: '2026-07-15T12:00:00.000Z', event: { category: 'authentication', action: 'login', result: 'failure' }, host: { id: 'host-1' }, service: { name: 'ssh' }, source: { ip: '203.0.113.10' } };
const sensitiveValue = ['test', 'sensitive', 'value'].join('-');
const processEvent = { nef_version: '1.0', id: 'evt-process-1', timestamp: '2026-07-15T12:00:01.000Z', event: { category: 'process', action: 'start' }, host: { id: 'host-1' }, user: { name: 'deploy' }, process: { name: 'curl', pid: 42, privilege: 'standard', command_line: `curl ${['--pass', 'word'].join('')} ${sensitiveValue}` } };
test('agent buffers then sends an authenticated NEF batch', async () => {
  const published = [], server = createIngestionServer({ agents: { test: { id: 'agent-1', token: 'secret' } }, publish: async events => published.push(...events) });
  await new Promise(resolve => server.listen(0, resolve));
  const agent = new NolenAgent({ endpoint: `http://127.0.0.1:${server.address().port}`, token: 'secret', bufferPath: join(await mkdtemp(join(tmpdir(), 'nolen-')), 'queue.jsonl') });
  await agent.collect([event]); assert.equal((await agent.flush()).delivered, 1); assert.deepEqual(published, [event]); assert.deepEqual(await agent.buffer.pending(), []);
  await new Promise(resolve => server.close(resolve));
});
test('agent and ingestion redact secrets before buffering and publication', async () => {
  const published = [], metadata = [], server = createIngestionServer({ agents: { test: { id: 'agent-1', token: 'secret' } }, publish: async (events, agent, details) => { published.push(...events); metadata.push(details); } });
  await new Promise(resolve => server.listen(0, resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const agent = new NolenAgent({ endpoint, token: 'secret', bufferPath: join(await mkdtemp(join(tmpdir(), 'nolen-')), 'queue.jsonl') });
  await agent.collect([processEvent]);
  assert.ok(!JSON.stringify(await agent.buffer.pending()).includes(sensitiveValue));
  await agent.flush();
  const raw = { ...processEvent, id: 'evt-process-2' };
  const response = await fetch(`${endpoint}/v1/ingest/events`, { method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' }, body: JSON.stringify({ events: [raw] }) });
  assert.equal(response.status, 202);
  assert.ok(!JSON.stringify(published).includes(sensitiveValue));
  assert.deepEqual(metadata.at(-1), { redactedEventIds: ['evt-process-2'] });
  await new Promise(resolve => server.close(resolve));
});
test('ingestion rejects invalid NEF and revoked identities', async () => {
  const published = [], server = createIngestionServer({ agents: { valid: { id: 'agent-1', token: 'good' }, revoked: { id: 'agent-2', token: 'bad', revoked: true } }, publish: async events => published.push(...events) }); await new Promise(resolve => server.listen(0, resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/ingest/events`;
  const send = (token, events) => fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ events }) });
  assert.equal((await send('bad', [event])).status, 401);
  assert.equal((await send('good', [{ ...event, timestamp: 'invalid' }])).status, 422);
  assert.deepEqual(published, []);
  await new Promise(resolve => server.close(resolve));
});
test('ingestion enforces batch and per-agent request limits', async () => {
  const server = createIngestionServer({ agents: { batch: { id: 'agent-batch', token: 'batch' }, rate: { id: 'agent-rate', token: 'rate' } }, maxBatch: 1, maxRequestsPerMinute: 1 });
  await new Promise(resolve => server.listen(0, resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/ingest/events`;
  const send = (token, events) => fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ events }) });
  assert.equal((await send('batch', [event, event])).status, 400);
  assert.equal((await send('rate', [event])).status, 202);
  assert.equal((await send('rate', [event])).status, 429);
  await new Promise(resolve => server.close(resolve));
});
test('application API requires an authorized analyst', async () => {
  const server = createApplicationServer({ events: [event], users: { viewer: { token: 'viewer', role: 'viewer' }, analyst: { token: 'analyst', role: 'analyst' } } });
  await new Promise(resolve => server.listen(0, resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/events`;
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { headers: { authorization: 'Bearer viewer' } })).status, 403);
  const response = await fetch(endpoint, { headers: { authorization: 'Bearer analyst' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { events: [event] });
  await new Promise(resolve => server.close(resolve));
});

test('application API delegates persistent event searches to the repository', async () => {
  let receivedFilters;
  const server = createApplicationServer({
    eventRepository: { search: async filters => { receivedFilters = filters; return [event]; } },
    users: { analyst: { token: 'analyst', role: 'analyst' } }
  });
  await new Promise(resolve => server.listen(0, resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/events?category=authentication&hostId=host-1&limit=20`, { headers: { authorization: 'Bearer analyst' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { events: [event] });
  assert.deepEqual(receivedFilters, { category: 'authentication', hostId: 'host-1', limit: '20' });
  await new Promise(resolve => server.close(resolve));
});

test('application API returns a bounded telemetry audit only to authorized analysts', async () => {
  let options;
  const server = createApplicationServer({ telemetryAuditor: { audit: async input => { options = input; return { summary: { status: 'healthy' } }; } }, users: { analyst: { token: 'analyst-token', role: 'analyst' } } });
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/v1/audit/telemetry?limit=12`, { headers: { Authorization: 'Bearer analyst-token' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { summary: { status: 'healthy' } });
  assert.deepEqual(options, { limit: 12 });
  const invalid = await fetch(`http://127.0.0.1:${port}/v1/audit/telemetry?limit=0`, { headers: { Authorization: 'Bearer analyst-token' } });
  assert.equal(invalid.status, 400);
  server.close();
});

test('application API reads persistent incidents with a bounded limit', async () => {
  let options;
  const storedIncident = { id: 'incident-1', severity: 'high' };
  const server = createApplicationServer({ incidentRepository: { list: async input => { options = input; return [storedIncident]; } }, users: { analyst: { token: 'analyst', role: 'analyst' } } });
  await new Promise(resolve => server.listen(0, resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/incidents`;
  const response = await fetch(`${endpoint}?limit=20`, { headers: { authorization: 'Bearer analyst' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { incidents: [storedIncident] });
  assert.deepEqual(options, { limit: 20 });
  assert.equal((await fetch(`${endpoint}?limit=0`, { headers: { authorization: 'Bearer analyst' } })).status, 400);
  await new Promise(resolve => server.close(resolve));
});
