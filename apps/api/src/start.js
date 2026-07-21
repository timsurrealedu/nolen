import { createApplicationServer } from './server.js';
import { createStorageClients } from '../../../services/event-store/src/clients.js';
import { createClickHouseEventRepository } from '../../../services/event-store/src/search.js';

const clients = createStorageClients();
const port = process.env.API_PORT ?? 3002;
createApplicationServer({
  eventRepository: createClickHouseEventRepository(clients.clickhouse),
  users: { local: { token: process.env.NOLEN_ANALYST_TOKEN ?? 'local-analyst-token', role: 'analyst' } }
}).listen(port, () => console.log(`Nolen API listening on ${port}`));
