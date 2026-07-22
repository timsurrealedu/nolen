import { randomBytes } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';

const names = [
  'postgres_admin_password', 'postgres_event_store_password', 'postgres_detection_password',
  'postgres_incident_store_password', 'postgres_api_password', 'clickhouse_admin_password',
  'clickhouse_event_store_password', 'clickhouse_api_password', 'nats_admin_password',
  'nats_ingestion_password', 'nats_event_store_password', 'nats_detection_password',
  'nats_incident_store_password', 'nats_api_password', 'agent_token', 'analyst_token',
  'console_analyst_password', 'console_admin_password'
];

await mkdir('secrets', { recursive: true, mode: 0o700 });
for (const name of names) {
  try {
    const file = await open(`secrets/${name}`, 'wx', 0o600);
    await file.writeFile(`${randomBytes(24).toString('hex')}\n`);
    await file.close();
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
}
console.log('Local secrets ready in secrets/ (existing values preserved).');
