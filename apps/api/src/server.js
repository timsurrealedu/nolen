import { createServer } from 'node:http';

const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
export function createApplicationServer({ events = [], incidents = [], agents = [] } = {}) {
  const subscribers = new Set();
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/v1/events') {
      const fields = ['category', 'hostId', 'user', 'sourceIp', 'result'];
      const filtered = events.filter(event => fields.every(field => !url.searchParams.get(field) || ({ category: event.event?.category, hostId: event.host?.id, user: event.user?.name, sourceIp: event.source?.ip, result: event.event?.result })[field] === url.searchParams.get(field)));
      return json(response, 200, { events: filtered });
    }
    if (request.method === 'GET' && url.pathname === '/v1/incidents') return json(response, 200, { incidents });
    if (request.method === 'GET' && url.pathname === '/v1/agents') return json(response, 200, { agents });
    if (request.method === 'GET' && url.pathname === '/v1/stream/incidents') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); subscribers.add(response); request.on('close', () => subscribers.delete(response)); return; }
    return json(response, 404, { error: 'not_found' });
  });
  server.publishCriticalIncident = incident => { incidents.push(incident); for (const response of subscribers) response.write(`event: critical-incident\ndata: ${JSON.stringify(incident)}\n\n`); };
  return server;
}
