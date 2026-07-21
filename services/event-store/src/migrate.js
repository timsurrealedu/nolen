import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createStorageClients } from './clients.js';

const postgresMigration = new URL('../../../infrastructure/postgres/001_event_idempotency.sql', import.meta.url);
const clickhouseMigration = new URL('../../../infrastructure/clickhouse/001_security_events.sql', import.meta.url);

export async function migrate({ clients = createStorageClients() } = {}) {
  try {
    await clients.pool.query(await readFile(postgresMigration, 'utf8'));
    await clients.clickhouse.command({ query: await readFile(clickhouseMigration, 'utf8') });
  } finally {
    await clients.close?.();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) migrate();
