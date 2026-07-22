import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { connectEventBus, INCIDENTS_STREAM } from '../../../packages/event-bus/src/nats.js';
import { createPostgresPool } from './clients.js';
import { createPostgresIncidentRepository } from './incidents.js';
import { loadNatsConfig, loadPostgresConfig } from '../../../packages/runtime-config/src/index.js';

export async function startIncidentStore() {
  const bus = await connectEventBus(await loadNatsConfig());
  const pool = createPostgresPool(await loadPostgresConfig());
  const incidents = createPostgresIncidentRepository(pool);
  const consumer = await bus.jetstream.consumers.get(INCIDENTS_STREAM, 'incident-store');
  const messages = await consumer.consume();
  (async () => {
    for await (const message of messages) {
      try {
        const incident = bus.codec.decode(message.data);
        if (!incident || typeof incident.id !== 'string' || !incident.id || !Number.isFinite(Date.parse(incident.createdAt)) || typeof incident.severity !== 'string' || typeof incident.status !== 'string') { message.term(); continue; }
        await incidents.persist(incident); message.ack();
      }
      catch (error) { console.error('incident persistence failed', error.message); message.nak(); }
    }
  })();
  return { ...bus, pool, incidents, messages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startIncidentStore();
