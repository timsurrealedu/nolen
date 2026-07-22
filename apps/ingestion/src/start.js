import { connectEventBus, createEventPublisher } from '../../../packages/event-bus/src/nats.js';
import { createIngestionServer } from './server.js';
import { configValue, loadNatsConfig } from '../../../packages/runtime-config/src/index.js';
import { readAgentCredential } from '../../../agent/src/credentials.js';

const bus = await connectEventBus(await loadNatsConfig());
const port = process.env.PORT ?? 3001;
const credential = process.env.NOLEN_AGENT_CREDENTIAL_FILE ? await readAgentCredential(process.env.NOLEN_AGENT_CREDENTIAL_FILE) : { agentId: 'agent-local', token: await configValue('NOLEN_AGENT_TOKEN', { localFallback: 'local-dev-token' }) };
createIngestionServer({
  agents: { configured: { id: credential.agentId, token: credential.token } },
  publish: createEventPublisher(bus)
}).listen(port, () => console.log(`Nolen ingestion listening on ${port}`));
