import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { connectEventBus, INCIDENTS_STREAM, INCIDENTS_SUBJECT } from '../../../packages/event-bus/src/nats.js';
import { createStorageClients } from './clients.js';
import { createPostgresIncidentRepository } from './incidents.js';
import { loadNatsConfig, loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

export async function startIncidentStore() {
  const bus = await connectEventBus(await loadNatsConfig());
  const clients = createStorageClients(await loadStorageConfig());
  const incidents = createPostgresIncidentRepository(clients.pool);
  const consumer = await bus.jetstream.consumers.get(INCIDENTS_STREAM, 'incident-store').catch(async () => {
    await bus.manager.consumers.add(INCIDENTS_STREAM, { durable_name: 'incident-store', ack_policy: 'explicit', filter_subject: INCIDENTS_SUBJECT });
    return bus.jetstream.consumers.get(INCIDENTS_STREAM, 'incident-store');
  });
  const messages = await consumer.consume();
  (async () => {
    for await (const message of messages) {
      try { await incidents.persist(bus.codec.decode(message.data)); message.ack(); }
      catch (error) { console.error('incident persistence failed', error.message); message.nak(); }
    }
  })();
  return { ...bus, clients, incidents, messages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startIncidentStore();
