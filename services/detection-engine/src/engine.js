const value = (event, path) => path.split('.').reduce((item, key) => item?.[key], event);
const at = event => Date.parse(typeof event === 'string' ? event : event.timestamp);
const key = (event, fields) => fields.map(field => value(event, field) ?? '').join('|');
const has = (event, expected) => Object.entries(expected).every(([field, want]) => {
  const actual = value(event, field);
  return Array.isArray(want) ? want.includes(actual) : actual === want;
});

const brute = { id: 'NOLEN-SSH-001', name: 'SSH Brute Force', severity: 'high', mitre: ['T1110'], match: { 'event.category': 'authentication', 'event.action': 'login', 'event.result': 'failure', 'service.name': 'ssh' }, fields: ['source.ip', 'user.name', 'host.id'], count: 10, within: 60_000 };
const invalidUser = { id: 'NOLEN-SSH-002', name: 'Repeated Invalid SSH User Attempts', severity: 'medium', mitre: ['T1190'], match: { 'event.category': 'authentication', 'event.action': 'invalid_user', 'service.name': 'ssh' }, fields: ['source.ip', 'host.id'], count: 5, within: 60_000 };
const privilegedShell = { id: 'NOLEN-PROC-001', name: 'Privileged Shell Spawned', severity: 'high', mitre: ['T1059.004'], match: { 'event.category': 'process', 'event.action': 'start', 'process.privilege': 'elevated' } };
const sensitiveFile = { id: 'NOLEN-FILE-001', name: 'Sensitive Authentication File Access', severity: 'high', mitre: ['T1003'], match: { 'event.category': 'file', 'event.action': 'access' } };
const shellNames = new Set(['bash', 'sh', 'zsh']);
const sensitivePaths = [/^\/etc\/(shadow|sudoers)/, /^\/home\/[^/]+\/\.ssh\/authorized_keys$/];

function detection(rule, events, entity = {}) {
  return { id: `${rule.id}:${events.map(event => event.id).join(',')}`, ruleId: rule.id, title: rule.name, severity: rule.severity, timestamp: events.at(-1).timestamp, evidenceEventIds: events.map(event => event.id), entities: entity, mitre: rule.mitre };
}

function countDetections(events, rule) {
  const groups = new Map();
  for (const event of events.filter(event => has(event, rule.match))) {
    const group = key(event, rule.fields);
    groups.set(group, [...(groups.get(group) ?? []), event]);
  }
  return [...groups.values()].flatMap(group => {
    const ordered = [...group].sort((a, b) => at(a) - at(b));
    const window = ordered.filter(event => at(event) >= at(ordered.at(-1)) - rule.within);
    return window.length >= rule.count ? [detection(rule, window, { sourceIp: value(window[0], 'source.ip'), user: value(window[0], 'user.name'), hostId: value(window[0], 'host.id') })] : [];
  });
}

export function detect(events) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => at(a) - at(b));
  const detections = [...countDetections(unique, brute), ...countDetections(unique, invalidUser)];
  for (const event of unique) {
    if (has(event, privilegedShell.match) && shellNames.has(value(event, 'process.name'))) detections.push(detection(privilegedShell, [event], { hostId: value(event, 'host.id'), user: value(event, 'user.name') }));
    if (has(event, sensitiveFile.match) && sensitivePaths.some(pattern => pattern.test(value(event, 'file.path') ?? ''))) detections.push(detection(sensitiveFile, [event], { hostId: value(event, 'host.id'), user: value(event, 'user.name') }));
  }
  for (const bruteDetection of detections.filter(item => item.ruleId === brute.id)) {
    const success = unique.find(event => has(event, { 'event.category': 'authentication', 'event.action': 'login', 'event.result': 'success', 'service.name': 'ssh' }) && value(event, 'host.id') === bruteDetection.entities.hostId && value(event, 'source.ip') === bruteDetection.entities.sourceIp && at(event) >= at(bruteDetection.timestamp) && at(event) - at(bruteDetection.timestamp) <= 300_000);
    if (success) detections.push({ ...detection({ id: 'NOLEN-SEQ-001', name: 'SSH Success After Brute Force', severity: 'critical', mitre: ['T1078'] }, [success], { ...bruteDetection.entities, user: value(success, 'user.name') }), evidenceEventIds: [...bruteDetection.evidenceEventIds, success.id] });
  }
  return detections;
}

export function correlate(detections) {
  const result = [];
  for (const sequence of detections.filter(item => item.ruleId === 'NOLEN-SEQ-001')) {
    const shell = detections.find(item => item.ruleId === 'NOLEN-PROC-001' && item.entities.hostId === sequence.entities.hostId && item.entities.user === sequence.entities.user && Math.abs(at(item) - at(sequence)) <= 300_000);
    if (!shell) continue;
    const confidence = 80; // base 50 + same host 10 + same user 10 + five-minute window 10
    result.push({ id: `NOLEN-CORR-001:${sequence.id}:${shell.id}`, title: 'Probable SSH Account Compromise', severity: 'critical', confidence, status: 'open', createdAt: shell.timestamp, entities: sequence.entities, detectionIds: [sequence.id, shell.id], evidenceEventIds: [...new Set([...sequence.evidenceEventIds, ...shell.evidenceEventIds])], mitre: ['T1110', 'T1078', 'T1059.004'] });
  }
  return result;
}
