import { createStorageClients } from './clients.js';
import { createClickHouseTelemetryAuditor } from './telemetry-audit.js';
import { loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

const limit = Number(process.env.AUDIT_EVENT_LIMIT ?? 10_000);
const clients = createStorageClients(await loadStorageConfig());
try {
  console.log(JSON.stringify(await createClickHouseTelemetryAuditor(clients.clickhouse).audit({ limit }), null, 2));
} finally {
  await clients.close();
}
