import { duration, loadRules } from '../../../packages/rule-parser/src/load.js';

const defaultRules = loadRules();
const value = (event, path) => path.split('.').reduce((item, field) => item?.[field], event);
const at = item => Date.parse(typeof item === 'string' ? item : item.timestamp);
const entityName = { 'source.ip': 'sourceIp', 'user.name': 'user', 'host.id': 'hostId' };
const entities = (event, fields) => Object.fromEntries(fields.map(field => [entityName[field] ?? field, value(event, field)]));
const techniques = rule => Array.isArray(rule.mitre) ? rule.mitre : rule.mitre?.technique ? [rule.mitre.technique] : [];
const glob = pattern => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}`);

function matches(event, expected = {}) {
  return Object.entries(expected).every(([field, wanted]) => {
    const actual = value(event, field.endsWith('_prefix') ? field.slice(0, -7) : field);
    if (field.endsWith('_prefix')) return wanted.some(pattern => glob(pattern).test(actual ?? ''));
    return Array.isArray(wanted) ? wanted.includes(actual) : actual === wanted;
  });
}

function applies(event, rule) {
  return (rule.matches ?? [rule.match]).some(expected => matches(event, expected))
    && (rule.require ?? []).every(field => value(event, field) != null)
    && (rule.absent ?? []).every(field => value(event, field) == null);
}

function detection(rule, events, entity = {}) {
  return { id: `${rule.id}:${events.map(event => event.id).join(',')}`, ruleId: rule.id, title: rule.name, severity: rule.severity, timestamp: events.at(-1).timestamp, evidenceEventIds: events.map(event => event.id), entities: entity, mitre: techniques(rule) };
}

function countDetections(events, rule) {
  const groups = new Map();
  for (const event of events.filter(event => applies(event, rule))) {
    const group = rule.group_by.map(field => value(event, field) ?? '').join('|');
    groups.set(group, [...(groups.get(group) ?? []), event]);
  }
  return [...groups.values()].flatMap(group => {
    const ordered = [...group].sort((a, b) => at(a) - at(b));
    const within = duration(rule.condition.within);
    for (let start = 0, end = 0; end < ordered.length; end += 1) {
      while (at(ordered[end]) - at(ordered[start]) > within) start += 1;
      if (end - start + 1 >= rule.condition.count) {
        const window = ordered.slice(start, end + 1);
        return [detection(rule, window, entities(window[0], rule.group_by))];
      }
    }
    return [];
  });
}

export function detect(events, { rules = defaultRules } = {}) {
  const unique = [...new Map(events.map(event => [event.id, event])).values()].sort((a, b) => at(a) - at(b));
  const atomic = [...rules.values()].filter(rule => rule.match || rule.matches);
  const detections = atomic.flatMap(rule => rule.condition
    ? countDetections(unique, rule)
    : unique.filter(event => applies(event, rule)).map(event => detection(rule, [event], entities(event, ['host.id', 'user.name']))));

  for (const rule of [...rules.values()].filter(item => item.sequence)) {
    const detectionIds = rule.sequence[0].any_detection;
    for (const precursor of detections.filter(item => detectionIds.includes(item.ruleId))) {
      const success = unique.find(event => matches(event, rule.sequence[1].event)
        && rule.same.every(field => value(event, field) === precursor.entities[entityName[field] ?? field])
        && at(event) >= at(precursor)
        && at(event) - at(precursor) <= duration(rule.within));
      if (success) detections.push({ ...detection(rule, [success], { ...precursor.entities, ...entities(success, ['user.name']), precursorDetectionId: precursor.id }), evidenceEventIds: [...precursor.evidenceEventIds, success.id] });
    }
  }
  return detections;
}

export function correlate(detections, { rules = defaultRules } = {}) {
  const incidents = [];
  for (const rule of [...rules.values()].filter(item => item.requires)) {
    const [precursorIds, sequenceId, activityId] = rule.requires;
    for (const sequence of detections.filter(item => item.ruleId === sequenceId)) {
      const precursor = detections.find(item => item.id === sequence.entities.precursorDetectionId && precursorIds.includes(item.ruleId));
      const activity = detections.find(item => item.ruleId === activityId
        && rule.same.every(field => item.entities[entityName[field] ?? field] === sequence.entities[entityName[field] ?? field])
        && at(item) >= at(sequence)
        && at(item) - at(sequence) <= duration(rule.within));
      if (!precursor || !activity) continue;
      incidents.push({ id: `${rule.id}:${precursor.id}:${sequence.id}:${activity.id}`, title: rule.name, severity: rule.severity, confidence: rule.confidence, status: 'open', createdAt: activity.timestamp, entities: sequence.entities, detectionIds: [precursor.id, sequence.id, activity.id], evidenceEventIds: [...new Set([...precursor.evidenceEventIds, ...sequence.evidenceEventIds, ...activity.evidenceEventIds])], mitre: techniques(rule) });
    }
  }
  return incidents;
}
