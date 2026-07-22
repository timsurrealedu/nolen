import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { connectEventBus, EVENTS_STREAM, RAW_EVENTS_SUBJECT } from '../../../packages/event-bus/src/nats.js';
import { createStorageClients } from './clients.js';
import { createEventStore } from './store.js';
import { loadNatsConfig, loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

export async function startEventStore() {
  const bus = await connectEventBus(await loadNatsConfig());
  const clients = createStorageClients(await loadStorageConfig());
  const store = createEventStore(clients);
  const consumer = await bus.jetstream.consumers.get(EVENTS_STREAM, 'event-store').catch(async () => {
    await bus.manager.consumers.add(EVENTS_STREAM, { durable_name: 'event-store', ack_policy: 'explicit', filter_subject: RAW_EVENTS_SUBJECT });
    return bus.jetstream.consumers.get(EVENTS_STREAM, 'event-store');
  });
  const messages = await consumer.consume();
  (async () => {
    for await (const message of messages) {
      try {
        const { event, agentId } = bus.codec.decode(message.data);
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
