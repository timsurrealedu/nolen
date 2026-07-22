import { validateEvent } from '../../packages/nef/src/validate.js';
import { buildFeatureTable, entityForEvent } from './feature-table.js';

const addFinding = (findings, severity, id, message, evidence, remediation) => findings.push({ severity, id, message, evidence, remediation });
const countBy = (values, key) => Object.fromEntries([...values.reduce((counts, value) => counts.set(key(value), (counts.get(key(value)) ?? 0) + 1), new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
const duplicateIds = values => [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map()).entries()].filter(([, count]) => count > 1).map(([id]) => id);

export function assessDataQuality(events, labels, { now = new Date().toISOString() } = {}) {
  const findings = [];
  const eventIds = events.map(event => event.id);
  const labelIds = labels.map(label => label.event_id);
  const eventIdSet = new Set(eventIds), labelIdSet = new Set(labelIds);
  const invalidEvents = events.map(event => ({ id: event.id, errors: validateEvent(event).errors })).filter(result => result.errors.length > 0);
  const duplicateEventIds = duplicateIds(eventIds);
  const duplicateLabelIds = duplicateIds(labelIds);
  const missingLabels = eventIds.filter(id => !labelIdSet.has(id));
  const orphanLabels = labelIds.filter(id => !eventIdSet.has(id));
  const futureEvents = events.filter(event => Date.parse(event.timestamp) > Date.parse(now)).map(event => event.id);
  const emptyUserNames = events.filter(event => typeof event?.user?.name === 'string' && event.user.name.trim() === '').map(event => event.id);
  const entitylessEvents = events.filter(event => !entityForEvent(event)).map(event => event.id);

  if (invalidEvents.length) addFinding(findings, 'critical', 'invalid_nef', 'Some events fail the NEF validation contract.', { affected_event_count: invalidEvents.length, examples: invalidEvents.slice(0, 5) }, 'Reject or repair these events before storage and feature generation.');
  if (duplicateEventIds.length) addFinding(findings, 'critical', 'duplicate_event_ids', 'Event IDs are not unique.', { duplicate_id_count: duplicateEventIds.length, examples: duplicateEventIds.slice(0, 5) }, 'Deduplicate at ingestion and investigate the producing agent or replay source.');
  if (duplicateLabelIds.length) addFinding(findings, 'critical', 'duplicate_label_ids', 'External labels are not unique by event ID.', { duplicate_id_count: duplicateLabelIds.length, examples: duplicateLabelIds.slice(0, 5) }, 'Keep exactly one ground-truth label for each event ID.');
  if (missingLabels.length) addFinding(findings, 'critical', 'missing_external_labels', 'Some events have no external ground-truth label.', { affected_event_count: missingLabels.length, examples: missingLabels.slice(0, 5) }, 'Add reviewed labels before using this dataset for supervised ML.');
  if (orphanLabels.length) addFinding(findings, 'high', 'orphan_labels', 'Some labels do not match an input event.', { affected_label_count: orphanLabels.length, examples: orphanLabels.slice(0, 5) }, 'Remove stale labels or restore their matching event data.');
  if (futureEvents.length) addFinding(findings, 'high', 'future_timestamps', 'Some events are timestamped after the report reference time.', { affected_event_count: futureEvents.length, examples: futureEvents.slice(0, 5), reference_time: now }, 'Check clock synchronization or exclude future-dated telemetry.');
  if (emptyUserNames.length) addFinding(findings, 'high', 'empty_user_names', 'Some usernames are empty strings.', { affected_event_count: emptyUserNames.length, examples: emptyUserNames.slice(0, 5) }, 'Emit a missing user field instead of an empty string; never coerce it during entity grouping.');
  if (entitylessEvents.length) addFinding(findings, 'medium', 'events_without_ml_entity', 'Some events lack host ID or source IP and cannot be assigned to a canonical ML entity.', { affected_event_count: entitylessEvents.length, rate: events.length ? entitylessEvents.length / events.length : 0, examples: entitylessEvents.slice(0, 5) }, 'Add source IP or a Timothy-approved session-correlation field before using these events for entity-window ML features.');

  const blocking = findings.some(finding => finding.severity === 'critical');
  const featureTable = blocking ? null : buildFeatureTable(events, labels);
  const rows = featureTable?.rows ?? [];
  const modelFeatures = ['event_count', 'failed_login_count', 'invalid_user_count', 'successful_login_count', 'distinct_user_count', 'elevated_shell_count', 'sensitive_file_access_count', 'cron_modify_count'];
  const zeroOnlyFeatures = rows.length === 0 ? modelFeatures : modelFeatures.filter(feature => rows.every(row => Number(row[feature]) === 0));
  const maliciousWindows = rows.filter(row => row.label === 'malicious').length;
  const minorityRate = rows.length ? Math.min(maliciousWindows, rows.length - maliciousWindows) / rows.length : 0;
  if (!blocking && zeroOnlyFeatures.length) addFinding(findings, 'medium', 'zero_only_features', 'Some configured model features have no observed signal.', { features: zeroOnlyFeatures }, 'Confirm telemetry collection for these features before relying on them in a model.');
  if (!blocking && rows.length && minorityRate < 0.1) addFinding(findings, 'medium', 'class_imbalance', 'The feature table has a minority class below 10% of windows.', { malicious_window_count: maliciousWindows, normal_window_count: rows.length - maliciousWindows, minority_rate: minorityRate }, 'Use precision/recall and class-aware training; do not rely on accuracy alone. Add representative labelled attack scenarios before making model claims.');

  const severityCounts = countBy(findings, finding => finding.severity);
  return {
    report_version: '1.0',
    assessed_at: now,
    intended_grain: { raw: 'one row per NEF event', ml: 'one row per five-minute canonical entity window' },
    summary: {
      status: blocking ? 'blocked' : findings.some(finding => finding.severity === 'high') ? 'needs_attention' : findings.some(finding => finding.severity === 'medium') ? 'ready_with_warnings' : 'ready_for_offline_ml',
      event_count: events.length,
      label_count: labels.length,
      finding_counts: severityCounts
    },
    profile: {
      event_time_range: events.length ? { minimum: events.map(event => event.timestamp).sort()[0], maximum: events.map(event => event.timestamp).sort().at(-1) } : null,
      event_categories: countBy(events, event => event.event?.category ?? 'missing'),
      entity_types: countBy(events.filter(event => entityForEvent(event)), event => entityForEvent(event).entity_type),
      label_distribution: countBy(labels, label => label.label),
      scenario_distribution: countBy(labels, label => label.scenario),
      ml_feature_rows: rows.length,
      ml_split_distribution: countBy(rows, row => row.split),
      ml_class_distribution: countBy(rows, row => row.label),
      zero_only_features: zeroOnlyFeatures
    },
    findings,
    assumptions: [
      'Labels are external ground truth used only for offline supervised ML.',
      'The canonical ML entity is source.ip + user.name + host.id when a username is present, otherwise source.ip + host.id.',
      'Events without a canonical entity are not silently assigned a synthetic username or source IP.'
    ]
  };
}
