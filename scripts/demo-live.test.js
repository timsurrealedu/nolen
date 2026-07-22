import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoEvent, runLiveDemo } from './demo-live.js';

test('runs an ingestion-to-search demo against injected local endpoints', async () => {
  const event = createDemoEvent('fixed');
  assert.equal(event.host.id, 'demo-host-fixed');
  let posted = false;
  const fetchFn = async (url, options = {}) => {
    if (options.method === 'POST') { posted = true; return { status: 202, text: async () => '', ok: true }; }
    return { ok: true, json: async () => ({ events: [{ id: JSON.parse(options.body ?? '{}').id ?? 'demo-1' }, { id: posted ? 'demo-1' : 'none' }] }) };
  };
  // The polling mock returns the ID carried by the URL's host suffix.
  const result = await runLiveDemo({ agentToken: 'agent', analystToken: 'analyst', healthCheck: async () => ({ status: 'healthy', checks: {} }), fetchFn: async (url, options) => {
    if (options?.method === 'POST') { posted = true; return { status: 202, text: async () => '', ok: true }; }
    return { ok: true, json: async () => ({ events: [{ id: posted ? url.match(/demo-host-(demo-\d+)/)?.[1] : 'missing' }] }) };
  } });
  assert.equal(result.status, 'verified');
});
