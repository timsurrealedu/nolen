import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { connectEventBus, createIncidentPublisher, EVENTS_STREAM } from '../../../packages/event-bus/src/nats.js';
import { createDetectionProcessor, InvalidDetectionEventError } from './processor.js';
import { createPostgresPool } from '../../event-store/src/clients.js';
import { createPostgresDetectionState } from './state.js';
import { loadNatsConfig, loadPostgresConfig } from '../../../packages/runtime-config/src/index.js';

export async function startDetectionConsumer() {
  const bus = await connectEventBus(await loadNatsConfig());
  const pool = createPostgresPool(await loadPostgresConfig());
  const processor = createDetectionProcessor({ publishIncident: createIncidentPublisher(bus), stateStore: createPostgresDetectionState(pool) });
  await processor.restore();
  const consumer = await bus.jetstream.consumers.get(EVENTS_STREAM, 'detection-engine');
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
  return { ...bus, pool, messages, processor };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startDetectionConsumer();
