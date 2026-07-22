import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { connectEventBus, EVENTS_STREAM } from '../../../packages/event-bus/src/nats.js';
import { createStorageClients } from './clients.js';
import { createEventStore } from './store.js';
import { loadNatsConfig, loadStorageConfig } from '../../../packages/runtime-config/src/index.js';
import { validateEvent } from '../../../packages/nef/src/validate.js';

export async function startEventStore() {
  const bus = await connectEventBus(await loadNatsConfig());
  const clients = createStorageClients(await loadStorageConfig());
  const store = createEventStore(clients);
  const consumer = await bus.jetstream.consumers.get(EVENTS_STREAM, 'event-store');
  const messages = await consumer.consume();
  (async () => {
    for await (const message of messages) {
      try {
        const { event, agentId } = bus.codec.decode(message.data);
        if (!validateEvent(event).valid || typeof agentId !== 'string' || !agentId) { message.term(); continue; }
        await store.persist(event, agentId);
        message.ack();
      } catch (error) {
        console.error('event-store persistence failed', error.message);
        message.nak();
      }
    }
  })();
  return { ...bus, clients, messages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startEventStore();
