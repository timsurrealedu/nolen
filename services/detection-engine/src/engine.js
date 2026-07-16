const value = (event, path) => path.split('.').reduce((item, key) => item?.[key], event);
const at = event => Date.parse(typeof event === 'string' ? event : event.timestamp);
const key = (event, fields) => fields.map(field => value(event, field) ?? '').join('|');
const has = (event, expected) => Object.entries(expected).every(([field, want]) => {
  const actual = value(event, field);
  return Array.isArray(want) ? want.includes(actual) : actual === want;
});

const knownUserBrute = { id: 'NOLEN-SSH-001', name: 'SSH Brute Force (Known User)', severity: 'high', mitre: ['T1110'], match: { 'event.category': 'authentication', 'event.action': 'login', 'event.result': 'failure', 'service.name': 'ssh' }, fields: ['source.ip', 'user.name', 'host.id'], count: 10, within: 60_000, predicate: event => Boolean(value(event, 'user.name')) };
const unknownUserBrute = { id: 'NOLEN-SSH-003', name: 'SSH Brute Force (Unknown User)', severity: 'high', mitre: ['T1110'], match: { 'event.category': 'authentication', 'event.action': 'login', 'event.result': 'failure', 'service.name': 'ssh' }, fields: ['source.ip', 'host.id'], count: 10, within: 60_000, predicate: event => value(event, 'user.name') == null };
const invalidUser = { id: 'NOLEN-SSH-002', name: 'Repeated Invalid SSH User Attempts', severity: 'medium', mitre: [], match: { 'event.category': 'authentication', 'event.action': 'invalid_user', 'service.name': 'ssh' }, fields: ['source.ip', 'host.id'], count: 5, within: 60_000 };
const privilegedShell = { id: 'NOLEN-PROC-001', name: 'Privileged Shell Spawned', severity: 'high', mitre: ['T1059.004'], match: { 'event.category': 'process', 'event.action': 'start', 'process.privilege': 'elevated' } };
const sensitiveFile = { id: 'NOLEN-FILE-001', name: 'Sensitive Authentication File Access', severity: 'high', mitre: ['T1003'], match: { 'event.category': 'file', 'event.action': 'access' } };
const shellNames = new Set(['bash', 'sh', 'zsh']);
const sensitiveAccessPaths = [/^\/etc\/(shadow|sudoers)/, /^\/home\/[^/]+\/\.ssh\/authorized_keys$/];
const sensitiveModifyPaths = [/^\/etc\/(shadow|sudoers|cron[^/]*)/, /^\/home\/[^/]+\/\.ssh\/authorized_keys$/];

function detection(rule, events, entity = {}) {
  return { id: `${rule.id}:${events.map(event => event.id).join(',')}`, ruleId: rule.id, title: rule.name, severity: rule.severity, timestamp: events.at(-1).timestamp, evidenceEventIds: events.map(event => event.id), entities: entity, mitre: rule.mitre };
}

function countDetections(events, rule) {
  const groups = new Map();
  for (const event of events.filter(event => has(event, rule.match) && (rule.predicate?.(event) ?? true))) {
    const group = key(event, rule.fields);
    groups.set(group, [...(groups.get(group) ?? []), event]);
  }
  return [...groups.values()].flatMap(group => {
    const ordered = [...group].sort((a, b) => at(a) - at(b));
    for (let start = 0, end = 0; end < ordered.length; end++) {
      while (at(ordered[end]) - at(ordered[start]) > rule.within) start++;
      if (end - start + 1 >= rule.count) {
        const window = ordered.slice(start, end + 1);
        return [detection(rule, window, { sourceIp: value(window[0], 'source.ip'), user: value(window[0], 'user.name'), hostId: value(window[0], 'host.id') })];
      }
    }
    return [];
  });
}

export function detect(events) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => at(a) - at(b));
  const detections = [...countDetections(unique, knownUserBrute), ...countDetections(unique, unknownUserBrute), ...countDetections(unique, invalidUser)];
  for (const event of unique) {
    if (has(event, privilegedShell.match) && shellNames.has(value(event, 'process.name'))) detections.push(detection(privilegedShell, [event], { hostId: value(event, 'host.id'), user: value(event, 'user.name') }));
    const path = value(event, 'file.path') ?? '';
    const isSensitiveAccess = value(event, 'event.action') === 'access' && sensitiveAccessPaths.some(pattern => pattern.test(path));
    const isSensitiveModification = value(event, 'event.action') === 'modify' && sensitiveModifyPaths.some(pattern => pattern.test(path));
    if (has(event, { 'event.category': 'file' }) && (isSensitiveAccess || isSensitiveModification)) detections.push(detection(sensitiveFile, [event], { hostId: value(event, 'host.id'), user: value(event, 'user.name') }));
  }
  for (const bruteDetection of detections.filter(item => [knownUserBrute.id, unknownUserBrute.id].includes(item.ruleId))) {
    const success = unique.find(event => has(event, { 'event.category': 'authentication', 'event.action': 'login', 'event.result': 'success', 'service.name': 'ssh' }) && value(event, 'host.id') === bruteDetection.entities.hostId && value(event, 'source.ip') === bruteDetection.entities.sourceIp && at(event) >= at(bruteDetection.timestamp) && at(event) - at(bruteDetection.timestamp) <= 300_000);
    if (success) detections.push({ ...detection({ id: 'NOLEN-SEQ-001', name: 'SSH Success After Brute Force', severity: 'critical', mitre: ['T1078'] }, [success], { ...bruteDetection.entities, user: value(success, 'user.name'), bruteDetectionId: bruteDetection.id }), evidenceEventIds: [...bruteDetection.evidenceEventIds, success.id] });
  }
  return detections;
}

export function correlate(detections) {
  const result = [];
  for (const sequence of detections.filter(item => item.ruleId === 'NOLEN-SEQ-001')) {
    const bruteDetection = detections.find(item => item.id === sequence.entities.bruteDetectionId && [knownUserBrute.id, unknownUserBrute.id].includes(item.ruleId));
    if (!bruteDetection) continue;
    const shell = detections.find(item => item.ruleId === 'NOLEN-PROC-001' && item.entities.hostId === sequence.entities.hostId && item.entities.user === sequence.entities.user && at(item) >= at(sequence) && at(item) - at(sequence) <= 300_000);
    if (!shell) continue;
    const confidence = 80; // base 50 + same host 10 + same user 10 + five-minute window 10
    result.push({ id: `NOLEN-CORR-001:${bruteDetection.id}:${sequence.id}:${shell.id}`, title: 'Probable SSH Account Compromise', severity: 'critical', confidence, status: 'open', createdAt: shell.timestamp, entities: sequence.entities, detectionIds: [bruteDetection.id, sequence.id, shell.id], evidenceEventIds: [...new Set([...bruteDetection.evidenceEventIds, ...sequence.evidenceEventIds, ...shell.evidenceEventIds])], mitre: ['T1110', 'T1078', 'T1059.004'] });
  }
  return result;
}
