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

export function createApplicationServer({ events = [], eventRepository, incidents = [], agents = [], users = {} } = {}) {
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
    if (request.method === 'GET' && url.pathname === '/v1/incidents') return json(response, 200, { incidents });
    if (request.method === 'GET' && url.pathname === '/v1/agents') return json(response, 200, { agents });
    if (request.method === 'GET' && url.pathname === '/v1/stream/incidents') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); subscribers.add(response); request.on('close', () => subscribers.delete(response)); return; }
    return json(response, 404, { error: 'not_found' });
  });
  server.publishCriticalIncident = incident => { incidents.push(incident); for (const response of subscribers) response.write(`event: critical-incident\ndata: ${JSON.stringify(incident)}\n\n`); };
  return server;
}
