import { createStorageClients } from './clients.js';
import { createRetentionPreview } from './retention.js';
import { loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

const days = Number(process.env.RETENTION_DAYS ?? 90);
const clients = createStorageClients(await loadStorageConfig());
try {
  console.log(JSON.stringify(await createRetentionPreview(clients.clickhouse).preview(days), null, 2));
} finally {
  await clients.close();
}
