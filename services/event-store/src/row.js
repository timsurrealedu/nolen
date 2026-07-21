const nullable = value => value ?? null;
const clickHouseTimestamp = value => new Date(value).toISOString().replace('T', ' ').replace('Z', '');

export function toSecurityEventRow(event, agentId) {
  return {
    event_id: event.id,
    event_timestamp: clickHouseTimestamp(event.timestamp),
    agent_id: nullable(agentId),
    nef_version: event.nef_version,
    host_id: event.host.id,
    host_name: nullable(event.host.name),
    category: event.event.category,
    action: event.event.action,
    result: nullable(event.event.result),
    user_name: nullable(event.user?.name),
    source_ip: nullable(event.source?.ip),
    service_name: nullable(event.service?.name),
    process_name: nullable(event.process?.name),
    process_pid: nullable(event.process?.pid),
    process_privilege: nullable(event.process?.privilege),
    file_path: nullable(event.file?.path),
    raw_nef: JSON.stringify(event)
  };
}
