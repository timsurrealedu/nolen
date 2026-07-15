import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NolenAgent } from '../agent/src/client.js';
import { createIngestionServer } from '../apps/ingestion/src/server.js';

const event = { nef_version: '1.0', id: 'evt-agent-1', timestamp: '2026-07-15T12:00:00.000Z', event: { category: 'authentication', action: 'login', result: 'failure' }, host: { id: 'host-1' }, service: { name: 'ssh' }, source: { ip: '203.0.113.10' } };
test('agent buffers then sends an authenticated NEF batch', async () => {
  const published = [], server = createIngestionServer({ agents: { test: { id: 'agent-1', token: 'secret' } }, publish: async events => published.push(...events) });
  await new Promise(resolve => server.listen(0, resolve));
  const agent = new NolenAgent({ endpoint: `http://127.0.0.1:${server.address().port}`, token: 'secret', bufferPath: join(await mkdtemp(join(tmpdir(), 'nolen-')), 'queue.jsonl') });
  await agent.collect([event]); assert.equal((await agent.flush()).delivered, 1); assert.deepEqual(published, [event]); assert.deepEqual(await agent.buffer.pending(), []);
  await new Promise(resolve => server.close(resolve));
});
test('ingestion rejects invalid NEF and revoked identities', async () => {
  const server = createIngestionServer({ agents: { revoked: { id: 'agent-1', token: 'bad', revoked: true } } }); await new Promise(resolve => server.listen(0, resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/ingest/events`, { method: 'POST', headers: { authorization: 'Bearer bad', 'content-type': 'application/json' }, body: JSON.stringify({ events: [event] }) });
  assert.equal(response.status, 401); await new Promise(resolve => server.close(resolve));
});
