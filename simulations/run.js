import { fileURLToPath } from 'node:url';
import { validateEvent } from '../packages/nef/src/validate.js';
import { correlate, detect } from '../services/detection-engine/src/engine.js';
import { securityScenarios } from './scenarios.js';

export const evaluateSecurityScenarios = () => securityScenarios().map(scenario => {
  const invalidEventIds = scenario.events.filter(event => !validateEvent(event).valid).map(event => event.id);
  const detections = detect(scenario.events);
  const incidents = correlate(detections);
  const ruleIds = [...new Set(detections.map(item => item.ruleId))].sort((left, right) => left.localeCompare(right));
  const expectedRuleIds = [...scenario.expectedRuleIds].sort((left, right) => left.localeCompare(right));
  return {
    id: scenario.id,
    eventCount: scenario.events.length,
    invalidEventIds,
    ruleIds,
    expectedRuleIds,
    incidentCount: incidents.length,
    expectedIncidentCount: scenario.expectedIncidentCount,
    incidents: incidents.map(incident => ({ title: incident.title, confidence: incident.confidence, detectionCount: incident.detectionIds.length, evidenceCount: incident.evidenceEventIds.length })),
    passed: invalidEventIds.length === 0 && ruleIds.length === expectedRuleIds.length && ruleIds.every((id, index) => id === expectedRuleIds[index]) && incidents.length === scenario.expectedIncidentCount
  };
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scenarios = evaluateSecurityScenarios();
  console.log(JSON.stringify({ mode: 'offline-fixtures-only', scenarios }, null, 2));
  if (scenarios.some(scenario => !scenario.passed)) process.exitCode = 1;
}
