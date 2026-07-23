import { createServer } from 'node:http';

const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
const eventFilters = url => Object.fromEntries(['category', 'action', 'hostId', 'user', 'sourceIp', 'result', 'start', 'end', 'limit'].flatMap(field => url.searchParams.has(field) ? [[field, url.searchParams.get(field)]] : []));
const filterInMemoryEvents = (events, filters) => events.filter(event => {
  const values = { category: event.event?.category, action: event.event?.action, hostId: event.host?.id, user: event.user?.name, sourceIp: event.source?.ip, result: event.event?.result };
  const timestamp = Date.parse(event.timestamp);
  return Object.entries(filters).every(([field, value]) => {
    if (field === 'limit') return true;
    if (field === 'start') return timestamp >= Date.parse(value);
    if (field === 'end') return timestamp <= Date.parse(value);
    return values[field] === value;
  });
});

export function createApplicationServer({ events = [], eventRepository, telemetryAuditor, shadowEnrichmentRepository, incidents = [], incidentRepository, agents = [], users = {} } = {}) {
  const subscribers = new Set();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const token = request.headers.authorization?.replace(/^Bearer\s+/, '');
    const user = Object.values(users).find(item => item.token === token);
    if (!user) return json(response, 401, { error: 'authentication_required' });
    if (!['analyst', 'admin'].includes(user.role)) return json(response, 403, { error: 'forbidden' });
    if (request.method === 'GET' && url.pathname === '/v1/events') {
      try {
        const filters = eventFilters(url);
        const matchingEvents = eventRepository ? await eventRepository.search(filters) : filterInMemoryEvents(events, filters);
        return json(response, 200, { events: matchingEvents });
      } catch (error) {
        return json(response, error instanceof RangeError ? 400 : 500, { error: error instanceof RangeError ? 'invalid_event_filter' : 'event_search_failed' });
      }
    }
    if (request.method === 'GET' && url.pathname === '/v1/audit/telemetry') {
      try {
        const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined;
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100_000)) return json(response, 400, { error: 'invalid_audit_limit' });
        if (!telemetryAuditor) return json(response, 503, { error: 'telemetry_audit_unavailable' });
        return json(response, 200, await telemetryAuditor.audit({ limit }));
      } catch { return json(response, 500, { error: 'telemetry_audit_failed' }); }
    }
    if (request.method === 'GET' && url.pathname === '/v1/ml/shadow-enrichment') {
      try {
        const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 50;
        if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) return json(response, 400, { error: 'invalid_shadow_enrichment_limit' });
        if (!shadowEnrichmentRepository) return json(response, 503, { error: 'shadow_enrichment_unavailable' });
        return json(response, 200, await shadowEnrichmentRepository.read({ limit }));
      } catch { return json(response, 503, { error: 'shadow_enrichment_unavailable' }); }
    }
    if (request.method === 'GET' && url.pathname === '/v1/incidents') {
      try {
        const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined;
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) return json(response, 400, { error: 'invalid_incident_limit' });
        const stored = incidentRepository ? await incidentRepository.list({ ...(limit === undefined ? {} : { limit }) }) : incidents;
        return json(response, 200, { incidents: stored });
      } catch (error) { return json(response, error instanceof RangeError ? 400 : 500, { error: error instanceof RangeError ? 'invalid_incident_limit' : 'incident_search_failed' }); }
    }
    if (request.method === 'GET' && url.pathname === '/v1/agents') return json(response, 200, { agents });
    if (request.method === 'GET' && url.pathname === '/v1/stream/incidents') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); subscribers.add(response); request.on('close', () => subscribers.delete(response)); return; }
    return json(response, 404, { error: 'not_found' });
  });
  server.publishCriticalIncident = incident => { incidents.push(incident); for (const response of subscribers) response.write(`event: critical-incident\ndata: ${JSON.stringify(incident)}\n\n`); };
  return server;
}
