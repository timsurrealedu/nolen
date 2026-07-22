import { validateEvent } from '../../../packages/nef/src/validate.js';
import { entityForEvent } from '../../../simulations/ml/feature-table.js';

const countBy = (values, key) => Object.fromEntries([...values.reduce((counts, value) => counts.set(key(value), (counts.get(key(value)) ?? 0) + 1), new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
const duplicateIds = values => [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map()).entries()].filter(([, count]) => count > 1).map(([id]) => id);
const finding = (severity, id, message, evidence, remediation) => ({ severity, id, message, evidence, remediation });

export function auditRawTelemetry(events, { now = new Date().toISOString() } = {}) {
  const invalid = events.map(event => ({ id: event.id, errors: validateEvent(event).errors })).filter(item => item.errors.length);
  const duplicates = duplicateIds(events.map(event => event.id));
  const entityless = events.filter(event => !entityForEvent(event)).map(event => event.id);
  const future = events.filter(event => Date.parse(event.timestamp) > Date.parse(now)).map(event => event.id);
  const findings = [];
  if (invalid.length) findings.push(finding('critical', 'invalid_nef', 'Stored events fail NEF validation.', { affected_event_count: invalid.length, examples: invalid.slice(0, 5) }, 'Trace the producer, repair the data, and preserve the rejected-event evidence.'));
  if (duplicates.length) findings.push(finding('critical', 'duplicate_event_ids', 'The audit sample contains duplicate event IDs.', { duplicate_id_count: duplicates.length, examples: duplicates.slice(0, 5) }, 'Check replay/idempotency behavior before using this telemetry downstream.'));
  if (future.length) findings.push(finding('high', 'future_timestamps', 'Some stored events are later than the audit reference time.', { affected_event_count: future.length, examples: future.slice(0, 5), reference_time: now }, 'Check agent clocks and timestamp normalization.'));
  if (entityless.length) findings.push(finding('medium', 'events_without_ml_entity', 'Some valid telemetry cannot form a canonical ML entity window.', { affected_event_count: entityless.length, rate: events.length ? entityless.length / events.length : 0, examples: entityless.slice(0, 5) }, 'Add source IP or a Timothy-approved session identifier to the telemetry contract.'));
  return {
    report_version: '1.0',
    assessed_at: now,
    scope: { event_limit: events.length, source: 'ClickHouse security_events FINAL' },
    summary: {
      status: findings.some(item => item.severity === 'critical') ? 'blocked' : findings.some(item => item.severity === 'high') ? 'needs_attention' : findings.length ? 'ready_with_warnings' : 'healthy',
      event_count: events.length,
      finding_counts: countBy(findings, item => item.severity)
    },
    profile: {
      event_time_range: events.length ? { minimum: events.map(event => event.timestamp).sort()[0], maximum: events.map(event => event.timestamp).sort().at(-1) } : null,
      event_categories: countBy(events, event => event.event?.category ?? 'missing'),
      entity_types: countBy(events.filter(event => entityForEvent(event)), event => entityForEvent(event).entity_type),
      canonical_entity_coverage: events.length ? (events.length - entityless.length) / events.length : 0
    },
    findings
  };
}

export function createClickHouseTelemetryAuditor(clickhouse) {
  return {
    async audit({ limit = 10_000, now } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100_000) throw new RangeError('limit must be an integer from 1 to 100000');
      const result = await clickhouse.query({ query: `SELECT raw_nef FROM security_events FINAL ORDER BY event_timestamp DESC LIMIT {limit:UInt32}`, query_params: { limit }, format: 'JSONEachRow' });
      const rows = await result.json();
      return auditRawTelemetry(rows.map(row => JSON.parse(row.raw_nef)), { now });
    }
  };
}
