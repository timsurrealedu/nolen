import { createApplicationServer } from './server.js';
import { createStorageClients } from '../../../services/event-store/src/clients.js';
import { createClickHouseEventRepository } from '../../../services/event-store/src/search.js';
import { createClickHouseTelemetryAuditor } from '../../../services/event-store/src/telemetry-audit.js';
import { createPostgresIncidentRepository } from '../../../services/event-store/src/incidents.js';
import { connectEventBus, INCIDENTS_STREAM, INCIDENTS_SUBJECT } from '../../../packages/event-bus/src/nats.js';
import { configValue, loadNatsConfig, loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

const clients = createStorageClients(await loadStorageConfig());
const port = process.env.API_PORT ?? 3002;
const server = createApplicationServer({
  eventRepository: createClickHouseEventRepository(clients.clickhouse),
  telemetryAuditor: createClickHouseTelemetryAuditor(clients.clickhouse),
  incidentRepository: createPostgresIncidentRepository(clients.pool),
  users: { local: { token: await configValue('NOLEN_ANALYST_TOKEN', { localFallback: 'local-analyst-token' }), role: 'analyst' } }
});
server.listen(port, () => console.log(`Nolen API listening on ${port}`));

const bus = await connectEventBus(await loadNatsConfig());
const consumer = await bus.jetstream.consumers.get(INCIDENTS_STREAM, 'api-incident-delivery').catch(async () => {
  await bus.manager.consumers.add(INCIDENTS_STREAM, { durable_name: 'api-incident-delivery', ack_policy: 'explicit', filter_subject: INCIDENTS_SUBJECT });
  return bus.jetstream.consumers.get(INCIDENTS_STREAM, 'api-incident-delivery');
});
for await (const message of await consumer.consume()) {
  try { server.publishCriticalIncident(bus.codec.decode(message.data)); message.ack(); }
  catch (error) { console.error('incident delivery failed', error.message); message.nak(); }
}
