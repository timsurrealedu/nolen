import { correlate, detect } from '../../services/detection-engine/src/engine.js';
import { sshCompromiseEvents } from './fixture.js';

const detections = detect(sshCompromiseEvents());
const incidents = correlate(detections);
console.log(JSON.stringify({ detectionRuleIds: detections.map(item => item.ruleId), incidents }, null, 2));
if (incidents.length !== 1) process.exitCode = 1;
