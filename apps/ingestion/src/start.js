import { connectEventBus, createEventPublisher } from '../../../packages/event-bus/src/nats.js';
import { createIngestionServer } from './server.js';
import { configValue, loadNatsConfig } from '../../../packages/runtime-config/src/index.js';

const bus = await connectEventBus(await loadNatsConfig());
const port = process.env.PORT ?? 3001;
createIngestionServer({
  agents: { local: { id: 'agent-local', token: await configValue('NOLEN_AGENT_TOKEN', { localFallback: 'local-dev-token' }) } },
  publish: createEventPublisher(bus)
}).listen(port, () => console.log(`Nolen ingestion listening on ${port}`));
