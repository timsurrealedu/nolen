import { correlate, detect } from './engine.js';
import { validateEvent } from '../../../packages/nef/src/validate.js';

export class InvalidDetectionEventError extends Error {}

export function createDetectionProcessor({ publishIncident = async () => {}, historyMs = 10 * 60_000, maxEvents = 50_000 } = {}) {
  const events = new Map();
  const publishedIncidents = new Set();

  return {
    async process(event) {
      const validation = validateEvent(event);
      if (!validation.valid) throw new InvalidDetectionEventError(`invalid detection event: ${validation.errors.join('; ')}`);
      events.set(event.id, event);
      const ordered = [...events.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      const cutoff = Date.parse(ordered.at(-1).timestamp) - historyMs;
      for (const stale of ordered.filter(item => Date.parse(item.timestamp) < cutoff)) events.delete(stale.id);
      while (events.size > maxEvents) events.delete(events.keys().next().value);

      const detections = detect([...events.values()]);
      const incidents = correlate(detections).filter(incident => !publishedIncidents.has(incident.id));
      for (const incident of incidents) {
        await publishIncident(incident);
        publishedIncidents.add(incident.id);
        while (publishedIncidents.size > maxEvents) publishedIncidents.delete(publishedIncidents.values().next().value);
      }
      return { detections, incidents };
    }
  };
}
