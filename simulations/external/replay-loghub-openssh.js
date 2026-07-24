import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { correlate, detect } from '../../services/detection-engine/src/engine.js';

const countBy = values => Object.fromEntries([...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));

export function summarizeOpenSshReplay(events) {
  const detections = detect(events);
  const incidents = correlate(detections);
  return {
    purpose: 'Read-only external telemetry replay; not ML training or ground truth.',
    input_event_count: events.length,
    detection_count: detections.length,
    detection_count_by_rule: countBy(detections.map(detection => detection.ruleId)),
    incident_count: incidents.length,
    incident_count_by_severity: countBy(incidents.map(incident => incident.severity)),
    evidence_samples: detections.slice(0, 5).map(detection => ({ rule_id: detection.ruleId, evidence_event_ids: detection.evidenceEventIds }))
  };
}

export async function replayLoghubOpenSsh({ eventsPath = new URL('../../data/processed/loghub-openssh/events.jsonl', import.meta.url), reportPath = new URL('../../data/processed/loghub-openssh/replay-report.json', import.meta.url) } = {}) {
  const events = (await readFile(eventsPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const report = summarizeOpenSshReplay(events);
  const destination = fileURLToPath(reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await replayLoghubOpenSsh(), null, 2));
