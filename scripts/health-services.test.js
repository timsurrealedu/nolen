import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLocalServices } from './health-services.js';

test('reports local storage and messaging health without needing live containers in tests', async () => {
  let closed = false;
  const report = await checkLocalServices({ clients: { pool: { query: async () => {} }, clickhouse: { query: async () => {} }, close: async () => { closed = true; } }, connectNats: async () => ({ drain: async () => {} }) });
  assert.equal(report.status, 'healthy');
  assert.equal(closed, true);
});
