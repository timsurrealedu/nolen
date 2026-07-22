import { createConsoleServer } from './server.js';
import { createStorageClients } from '../../../services/event-store/src/clients.js';
import { createPostgresIncidentRepository } from '../../../services/event-store/src/incidents.js';
import { createClickHouseEventRepository } from '../../../services/event-store/src/search.js';
import { configValue, loadNatsConfig, loadStorageConfig } from '../../../packages/runtime-config/src/index.js';
import { connectEventBus, INCIDENTS_STREAM } from '../../../packages/event-bus/src/nats.js';
import { loadRules } from '../../../packages/rule-parser/src/load.js';

const clients = createStorageClients(await loadStorageConfig());
const server = createConsoleServer({
  users: {
    analyst: { password: await configValue('NOLEN_CONSOLE_ANALYST_PASSWORD', { localFallback: 'local-analyst-password' }), role: 'analyst' },
    admin: { password: await configValue('NOLEN_CONSOLE_ADMIN_PASSWORD', { localFallback: 'local-admin-password' }), role: 'admin' }
  },
  incidentRepository: createPostgresIncidentRepository(clients.pool),
  eventRepository: createClickHouseEventRepository(clients.clickhouse),
  rules: [...loadRules().values()].map(({ id, name, severity, mitre }) => ({ id, name, severity, mitre })),
  secure: process.env.NOLEN_LOCAL_DEV !== 'true',
  assetDirectory: new URL('../dist/', import.meta.url)
});
server.listen(process.env.CONSOLE_PORT ?? 3000, () => console.log('Nolen SOC console listening'));

const bus = await connectEventBus(await loadNatsConfig());
const consumer = await bus.jetstream.consumers.get(INCIDENTS_STREAM, 'console-incident-delivery');
for await (const message of await consumer.consume()) {
  try { server.publishIncident(bus.codec.decode(message.data)); message.ack(); }
  catch (error) { console.error('console incident delivery failed', error.message); message.nak(); }
}
