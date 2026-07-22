import { createStorageClients } from './clients.js';
import { createRetentionPreview } from './retention.js';

const days = Number(process.env.RETENTION_DAYS ?? 90);
const clients = createStorageClients();
try {
  console.log(JSON.stringify(await createRetentionPreview(clients.clickhouse).preview(days), null, 2));
} finally {
  await clients.close();
}
