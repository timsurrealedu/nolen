import { connectEventBus, EVENTS_STREAM, INCIDENTS_STREAM, RAW_EVENTS_SUBJECT, INCIDENTS_SUBJECT } from '../packages/event-bus/src/nats.js';
import { loadNatsConfig } from '../packages/runtime-config/src/index.js';

const bus = await connectEventBus({ ...await loadNatsConfig(), ensureStreams: true });
for (const [stream, durable_name, filter_subject] of [
  [EVENTS_STREAM, 'event-store', RAW_EVENTS_SUBJECT],
  [EVENTS_STREAM, 'detection-engine', RAW_EVENTS_SUBJECT],
  [INCIDENTS_STREAM, 'incident-store', INCIDENTS_SUBJECT],
  [INCIDENTS_STREAM, 'api-incident-delivery', INCIDENTS_SUBJECT]
]) {
  await bus.jetstream.consumers.get(stream, durable_name).catch(() => bus.manager.consumers.add(stream, { durable_name, ack_policy: 'explicit', filter_subject }));
}
await bus.connection.drain();
console.log('NATS streams and durable consumers are ready.');
