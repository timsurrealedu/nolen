import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventStore } from '../src/store.js';

const event = { nef_version: '1.0', id: 'evt-store-1', timestamp: '2026-07-21T08:00:00.000Z', host: { id: 'host-1' }, event: { category: 'authentication', action: 'login', result: 'failure' }, source: { ip: '203.0.113.10' }, service: { name: 'ssh' } };

test('stores a new event once and skips a duplicate event ID', async () => {
  const claimed = new Set(), rows = [];
  const ledger = { claim: async id => {
    if (claimed.has(id)) return { accepted: false };
    claimed.add(id);
    return { accepted: true, commit: async () => {}, rollback: async () => claimed.delete(id) };
  } };
  const store = createEventStore({ ledger, events: { insert: async row => rows.push(row) } });
  assert.deepEqual(await store.persist(event, 'agent-1'), { stored: true, duplicate: false });
  assert.deepEqual(await store.persist(event, 'agent-1'), { stored: false, duplicate: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_timestamp, '2026-07-21 08:00:00.000');
  assert.equal(rows[0].raw_nef.includes('evt-store-1'), true);
});

test('releases an idempotency claim when ClickHouse persistence fails', async () => {
  let rolledBack = false;
  const store = createEventStore({
    ledger: { claim: async () => ({ accepted: true, commit: async () => {}, rollback: async () => { rolledBack = true; } }) },
    events: { insert: async () => { throw new Error('clickhouse unavailable'); } }
  });
  await assert.rejects(store.persist(event, 'agent-1'), /clickhouse unavailable/);
  assert.equal(rolledBack, true);
});
