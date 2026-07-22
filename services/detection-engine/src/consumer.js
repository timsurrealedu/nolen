import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { connectEventBus, createIncidentPublisher, EVENTS_STREAM, RAW_EVENTS_SUBJECT } from '../../../packages/event-bus/src/nats.js';
import { createDetectionProcessor, InvalidDetectionEventError } from './processor.js';
import { createStorageClients } from '../../event-store/src/clients.js';
import { createPostgresDetectionState } from './state.js';
import { loadNatsConfig, loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

export async function startDetectionConsumer() {
  const bus = await connectEventBus(await loadNatsConfig());
  const clients = createStorageClients(await loadStorageConfig());
  const processor = createDetectionProcessor({ publishIncident: createIncidentPublisher(bus), stateStore: createPostgresDetectionState(clients.pool) });
  await processor.restore();
  const consumer = await bus.jetstream.consumers.get(EVENTS_STREAM, 'detection-engine').catch(async () => {
    await bus.manager.consumers.add(EVENTS_STREAM, { durable_name: 'detection-engine', ack_policy: 'explicit', filter_subject: RAW_EVENTS_SUBJECT });
    return bus.jetstream.consumers.get(EVENTS_STREAM, 'detection-engine');
  });
  const messages = await consumer.consume();
  (async () => {
    for await (const message of messages) {
      try {
        const { event } = bus.codec.decode(message.data);
        await processor.process(event);
        message.ack();
      } catch (error) {
        console.error('detection processing failed', error.message);
        if (error instanceof InvalidDetectionEventError) message.term();
        else message.nak();
      }
    }
  })();
  return { ...bus, clients, messages, processor };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startDetectionConsumer();
