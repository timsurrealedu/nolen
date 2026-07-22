import { checkLocalServices } from './health-services.js';
import { configValue } from '../packages/runtime-config/src/index.js';

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function createDemoEvent(id) {
  return { nef_version: '1.0', id, timestamp: new Date().toISOString(), host: { id: `demo-host-${id}`, name: 'nolen-demo' }, user: { name: 'demo-user' }, source: { ip: '203.0.113.200' }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } };
}

export async function waitForStoredEvent({ fetchFn = fetch, event, analystToken, attempts = 20, intervalMs = 500 } = {}) {
  analystToken ??= await configValue('NOLEN_ANALYST_TOKEN', { localFallback: 'local-analyst-token' });
  const url = `http://127.0.0.1:3002/v1/events?hostId=${encodeURIComponent(event.host.id)}&limit=20`;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchFn(url, { headers: { Authorization: `Bearer ${analystToken}` } });
    if (response.ok && (await response.json()).events.some(item => item.id === event.id)) return true;
    await sleep(intervalMs);
  }
  return false;
}

export async function runLiveDemo({ fetchFn = fetch, healthCheck = checkLocalServices, agentToken, analystToken } = {}) {
  const health = await healthCheck();
  if (health.status !== 'healthy') throw new Error(`Local services are not healthy: ${JSON.stringify(health.checks)}`);
  const event = createDemoEvent(`demo-${Date.now()}`);
  agentToken ??= await configValue('NOLEN_AGENT_TOKEN', { localFallback: 'local-dev-token' });
  const response = await fetchFn('http://127.0.0.1:3001/v1/ingest/events', { method: 'POST', headers: { Authorization: `Bearer ${agentToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [event] }) });
  if (response.status !== 202) throw new Error(`Ingestion failed: ${response.status} ${await response.text()}`);
  if (!await waitForStoredEvent({ fetchFn, event, analystToken })) throw new Error(`Event ${event.id} was accepted but was not found through the analyst API.`);
  return { status: 'verified', event_id: event.id, host_id: event.host.id };
}

if (process.argv[1]?.endsWith('demo-live.js')) {
  try { console.log(JSON.stringify(await runLiveDemo(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
