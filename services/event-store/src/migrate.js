import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createStorageClients } from './clients.js';
import { loadStorageConfig } from '../../../packages/runtime-config/src/index.js';

const postgresMigrations = [
  new URL('../../../infrastructure/postgres/001_event_idempotency.sql', import.meta.url),
  new URL('../../../infrastructure/postgres/002_detection_and_incidents.sql', import.meta.url),
  new URL('../../../infrastructure/postgres/003_incidents.sql', import.meta.url)
];
const clickhouseMigration = new URL('../../../infrastructure/clickhouse/001_security_events.sql', import.meta.url);

export async function migrate({ clients } = {}) {
  clients ??= createStorageClients(await loadStorageConfig());
  try {
    for (const migration of postgresMigrations) await clients.pool.query(await readFile(migration, 'utf8'));
    await clients.clickhouse.command({ query: await readFile(clickhouseMigration, 'utf8') });
  } finally {
    await clients.close?.();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) migrate();
