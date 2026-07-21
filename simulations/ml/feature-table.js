const WINDOW_MS = 5 * 60 * 1_000;
const MALICIOUS_LABELS = new Set(['brute_force', 'successful_compromise', 'privileged_activity']);
const ELEVATED_SHELLS = new Set(['bash', 'sh', 'zsh']);
const SENSITIVE_FILES = new Set(['/etc/shadow', '/etc/sudoers', '/root/.ssh/authorized_keys']);

const hasText = value => typeof value === 'string' && value.trim().length > 0;
const date = timestamp => timestamp.slice(0, 10);
const csvValue = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const sorted = values => [...values].sort();

export function entityForEvent(event) {
  const hostId = event?.host?.id;
  const sourceIp = event?.source?.ip;
  const userName = hasText(event?.user?.name) ? event.user.name : null;
  if (!hasText(hostId) || !hasText(sourceIp)) return null;
  return {
    entity_type: userName === null ? 'unknown_user' : 'known_user',
    host_id: hostId,
    source_ip: sourceIp,
    user_name: userName
  };
}

function windowStart(timestamp) {
  const milliseconds = Date.parse(timestamp);
  if (Number.isNaN(milliseconds)) throw new Error(`Invalid event timestamp: ${timestamp}`);
  return new Date(Math.floor(milliseconds / WINDOW_MS) * WINDOW_MS).toISOString();
}

function keyFor(window, entity) {
  return [window, entity.entity_type, entity.host_id, entity.source_ip, entity.user_name ?? '<absent>'].join('|');
}

function createRow(window, entity) {
  return {
    window_start: window,
    ...entity,
    event_count: 0,
    failed_login_count: 0,
    invalid_user_count: 0,
    successful_login_count: 0,
    distinct_user_count: 0,
    elevated_shell_count: 0,
    sensitive_file_access_count: 0,
    cron_modify_count: 0,
    scenarios: new Set(),
    ground_truth_labels: new Set(),
    users: new Set()
  };
}

function applyEvent(row, event, label) {
  row.event_count += 1;
  if (hasText(event?.user?.name)) row.users.add(event.user.name);
  row.scenarios.add(label.scenario);
  row.ground_truth_labels.add(label.label);
  const category = event.event?.category;
  const action = event.event?.action;
  const result = event.event?.result;
  if (category === 'authentication' && action === 'login' && result === 'failure') row.failed_login_count += 1;
  if (category === 'authentication' && action === 'invalid_user') row.invalid_user_count += 1;
  if (category === 'authentication' && action === 'login' && result === 'success') row.successful_login_count += 1;
  if (category === 'process' && action === 'start' && event.process?.privilege === 'elevated' && ELEVATED_SHELLS.has(event.process?.name)) row.elevated_shell_count += 1;
  if (category === 'file' && action === 'access' && SENSITIVE_FILES.has(event.file?.path)) row.sensitive_file_access_count += 1;
  if (category === 'file' && action === 'modify' && event.file?.path?.startsWith('/etc/cron')) row.cron_modify_count += 1;
}

function deriveSplit(row, { timeCutoff, testScenarios }) {
  const scenarioHeldOut = [...row.scenarios].some(scenario => testScenarios.has(scenario));
  return scenarioHeldOut || row.window_start >= timeCutoff ? 'test' : 'train';
}

export function buildFeatureTable(events, labels, { testScenarios = ['invalid_user_enumeration', 'ssh_compromise'], timeCutoff } = {}) {
  const labelsByEventId = new Map(labels.map(label => [label.event_id, label]));
  const rows = new Map();
  const eventDates = sorted(new Set(events.map(event => date(event.timestamp))));
  if (eventDates.length === 0) return { rows: [], metadata: { input_event_count: 0, skipped_event_count: 0, time_cutoff: null } };
  const cutoffDate = timeCutoff ?? eventDates[Math.min(eventDates.length - 1, Math.ceil(eventDates.length * 0.7))];
  const cutoff = `${cutoffDate}T00:00:00.000Z`;
  let skippedEventCount = 0;
  for (const event of events) {
    const label = labelsByEventId.get(event.id);
    if (!label) throw new Error(`Missing external label for event ${event.id}`);
    const entity = entityForEvent(event);
    if (!entity) {
      skippedEventCount += 1;
      continue;
    }
    const start = windowStart(event.timestamp);
    const key = keyFor(start, entity);
    const row = rows.get(key) ?? createRow(start, entity);
    applyEvent(row, event, label);
    rows.set(key, row);
  }
  const heldOutScenarios = new Set(testScenarios);
  const outputRows = [...rows.values()].map(row => {
    const labelsInWindow = sorted(row.ground_truth_labels);
    const scenarios = sorted(row.scenarios);
    return {
      window_start: row.window_start,
      entity_type: row.entity_type,
      host_id: row.host_id,
      source_ip: row.source_ip,
      user_name: row.user_name,
      event_count: row.event_count,
      failed_login_count: row.failed_login_count,
      invalid_user_count: row.invalid_user_count,
      successful_login_count: row.successful_login_count,
      distinct_user_count: row.users.size,
      elevated_shell_count: row.elevated_shell_count,
      sensitive_file_access_count: row.sensitive_file_access_count,
      cron_modify_count: row.cron_modify_count,
      scenarios: scenarios.join(';'),
      ground_truth_labels: labelsInWindow.join(';'),
      label: labelsInWindow.some(label => MALICIOUS_LABELS.has(label)) ? 'malicious' : 'normal',
      is_malicious: labelsInWindow.some(label => MALICIOUS_LABELS.has(label)),
      split: deriveSplit(row, { timeCutoff: cutoff, testScenarios: heldOutScenarios })
    };
  }).sort((left, right) => left.window_start.localeCompare(right.window_start) || left.host_id.localeCompare(right.host_id) || left.source_ip.localeCompare(right.source_ip));
  return { rows: outputRows, metadata: { input_event_count: events.length, output_row_count: outputRows.length, skipped_event_count: skippedEventCount, time_cutoff: cutoff, test_scenarios: [...heldOutScenarios].sort() } };
}

export function toCsv(rows) {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  return `${columns.join(',')}\n${rows.map(row => columns.map(column => csvValue(row[column])).join(',')).join('\n')}\n`;
}
