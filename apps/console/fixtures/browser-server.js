import { createConsoleServer } from '../src/server.js';

const hostile = '<img src=x onerror="globalThis.__nolenXss = true">';
const incident = { id: 'incident-browser-1', title: hostile, severity: 'high', status: 'open', confidence: 80, createdAt: '2026-07-22T00:00:00.000Z', entities: { hostId: hostile, user: '</textarea><svg onload="globalThis.__nolenXss = true">' }, evidenceEventIds: ['event-browser-1'], mitre: ['T1110'] };
const server = createConsoleServer({
  users: { analyst: { password: 'analyst-password', role: 'analyst' }, admin: { password: 'admin-password', role: 'admin' } },
  incidentRepository: { list: async () => [incident], updateStatus: async (id, status) => ({ ...incident, id, status }) },
  eventRepository: { search: async () => [{ id: 'event-browser-1', timestamp: incident.createdAt, host: { id: hostile }, user: { name: hostile }, event: { category: 'process', action: 'start' }, process: { command_line: 'curl --password [REDACTED]' } }] },
  agents: [{ hostname: hostile, version: '1.0.0', status: 'online', lastHeartbeat: incident.createdAt }], secure: false,
  assetDirectory: new URL('../dist/', import.meta.url)
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
process.on('SIGTERM', () => server.close(() => process.exit()));
