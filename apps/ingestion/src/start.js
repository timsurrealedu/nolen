import { connectEventBus, createEventPublisher } from '../../../packages/event-bus/src/nats.js';
import { createIngestionServer } from './server.js';

const bus = await connectEventBus();
const port = process.env.PORT ?? 3001;
createIngestionServer({
  agents: { local: { id: 'agent-local', token: process.env.NOLEN_AGENT_TOKEN ?? 'local-dev-token' } },
  publish: createEventPublisher(bus)
}).listen(port, () => console.log(`Nolen ingestion listening on ${port}`));
