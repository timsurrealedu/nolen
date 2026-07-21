import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventSearchQuery, createClickHouseEventRepository } from '../src/search.js';

test('builds a parameterized ClickHouse event search with bounded filters', () => {
  const search = buildEventSearchQuery({ category: 'authentication', hostId: 'host-1', sourceIp: '203.0.113.10', start: '2026-07-21T08:00:00Z', end: '2026-07-21T09:00:00Z', limit: '25' });
  assert.match(search.query, /category = \{category:String\}/);
  assert.match(search.query, /host_id = \{hostId:String\}/);
  assert.match(search.query, /event_timestamp >= \{start:DateTime64\(3, 'UTC'\)\}/);
  assert.match(search.query, /LIMIT 25$/);
  assert.deepEqual(search.query_params, { category: 'authentication', hostId: 'host-1', sourceIp: '203.0.113.10', start: '2026-07-21 08:00:00.000', end: '2026-07-21 09:00:00.000' });
});

test('returns parsed redacted NEF events from ClickHouse', async () => {
  let request;
  const repository = createClickHouseEventRepository({ query: async options => {
    request = options;
    return { json: async () => [{ raw_nef: JSON.stringify({ id: 'evt-search-1', event: { category: 'authentication' } }) }] };
  } });
  assert.deepEqual(await repository.search({ category: 'authentication' }), [{ id: 'evt-search-1', event: { category: 'authentication' } }]);
  assert.equal(request.format, 'JSONEachRow');
});

test('rejects malformed time filters and unbounded negative limits', () => {
  assert.throws(() => buildEventSearchQuery({ start: 'not-a-date' }), /ISO-8601/);
  assert.throws(() => buildEventSearchQuery({ limit: '0' }), /positive integer/);
});
