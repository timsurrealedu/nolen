import { connect, JSONCodec } from 'nats';

export const RAW_EVENTS_SUBJECT = 'events.raw';
export const EVENTS_STREAM = 'NOLEN_EVENTS';

export async function connectEventBus({ servers = process.env.NATS_URL ?? 'nats://127.0.0.1:4222' } = {}) {
  const connection = await connect({ servers });
  const manager = await connection.jetstreamManager();
  try {
    await manager.streams.info(EVENTS_STREAM);
  } catch {
    await manager.streams.add({ name: EVENTS_STREAM, subjects: [RAW_EVENTS_SUBJECT], storage: 'file', retention: 'limits' });
  }
  return { connection, manager, jetstream: connection.jetstream(), codec: JSONCodec() };
}

export function createEventPublisher({ jetstream, codec = JSONCodec() }) {
  return async (events, agent, metadata = {}) => Promise.all(events.map(event => jetstream.publish(
    RAW_EVENTS_SUBJECT,
    codec.encode({ event, agentId: agent.id, redacted: metadata.redactedEventIds?.includes(event.id) ?? false }),
    { msgID: event.id }
  )));
}
