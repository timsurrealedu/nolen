import { connect, JSONCodec } from 'nats';

export const RAW_EVENTS_SUBJECT = 'events.raw';
export const EVENTS_STREAM = 'NOLEN_EVENTS';
export const INCIDENTS_SUBJECT = 'incidents.created';
export const INCIDENTS_STREAM = 'NOLEN_INCIDENTS';

export async function connectEventBus({ ensureStreams = false, ...options }) {
  const connection = await connect(options);
  const jetstream = connection.jetstream();
  let manager;
  if (ensureStreams) {
    manager = await connection.jetstreamManager();
    try { await manager.streams.info(EVENTS_STREAM); }
    catch { await manager.streams.add({ name: EVENTS_STREAM, subjects: [RAW_EVENTS_SUBJECT], storage: 'file', retention: 'limits' }); }
    try { await manager.streams.info(INCIDENTS_STREAM); }
    catch { await manager.streams.add({ name: INCIDENTS_STREAM, subjects: [INCIDENTS_SUBJECT], storage: 'file', retention: 'limits' }); }
  }
  return { connection, manager, jetstream, codec: JSONCodec() };
}

export function createIncidentPublisher({ jetstream, codec = JSONCodec() }) {
  return incident => jetstream.publish(INCIDENTS_SUBJECT, codec.encode(incident), { msgID: incident.id });
}

export function createEventPublisher({ jetstream, codec = JSONCodec() }) {
  return async (events, agent, metadata = {}) => Promise.all(events.map(event => jetstream.publish(
    RAW_EVENTS_SUBJECT,
    codec.encode({ event, agentId: agent.id, redacted: metadata.redactedEventIds?.includes(event.id) ?? false }),
    { msgID: event.id }
  )));
}
