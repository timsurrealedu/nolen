import { createServer } from 'node:http';
import { sanitizeEvent, validateEvent } from '../../../packages/nef/src/validate.js';

const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
const read = request => new Promise((resolve, reject) => { let body = ''; request.on('data', chunk => { body += chunk; if (body.length > 1_000_000) request.destroy(); }); request.on('end', () => resolve(body)); request.on('error', reject); });

export function createIngestionServer({ agents = {}, publish = async () => {}, maxBatch = 100, maxRequestsPerMinute = 60 } = {}) {
  const requests = new Map();
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/ingest/events') return json(response, 404, { error: 'not_found' });
    const token = request.headers.authorization?.replace(/^Bearer\s+/, '');
    const agent = Object.values(agents).find(item => item.token === token);
    if (!agent || agent.revoked) return json(response, 401, { error: 'invalid_or_revoked_agent' });
    const now = Date.now(), history = (requests.get(agent.id) ?? []).filter(time => time > now - 60_000);
    if (history.length >= maxRequestsPerMinute) return json(response, 429, { error: 'rate_limited' });
    requests.set(agent.id, [...history, now]);
    try {
      const payload = JSON.parse(await read(request));
      if (!Array.isArray(payload.events) || !payload.events.length || payload.events.length > maxBatch) return json(response, 400, { error: 'invalid_batch', maxBatch });
      const sanitized = payload.events.map(sanitizeEvent);
      const events = sanitized.map(item => item.event);
      const invalid = events.map((event, index) => ({ index, errors: validateEvent(event).errors })).filter(item => item.errors.length);
      if (invalid.length) return json(response, 422, { error: 'nef_validation_failed', invalid });
      await publish(events, agent, { redactedEventIds: sanitized.flatMap((item, index) => item.redacted ? [events[index].id] : []) });
      return json(response, 202, { acceptedEventIds: events.map(event => event.id) });
    } catch { return json(response, 400, { error: 'invalid_json' }); }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) createIngestionServer({ agents: { local: { id: 'agent-local', token: process.env.NOLEN_AGENT_TOKEN ?? 'local-dev-token' } }, publish: async events => console.log(`published ${events.length} events`) }).listen(process.env.PORT ?? 3001);
