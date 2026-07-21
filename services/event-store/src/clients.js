import { createClient } from '@clickhouse/client';
import { Pool } from 'pg';
import { createPostgresLedger } from './ledger.js';

export function createStorageClients({ postgresUrl = process.env.POSTGRES_URL ?? 'postgres://postgres:nolen@127.0.0.1:5432/nolen', clickhouseUrl = process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123' } = {}) {
  const pool = new Pool({ connectionString: postgresUrl });
  const clickhouse = createClient({ url: clickhouseUrl });
  return {
    pool,
    clickhouse,
    ledger: createPostgresLedger(pool),
    events: {
      insert: row => clickhouse.insert({ table: 'security_events', values: [row], format: 'JSONEachRow' })
    },
    async close() { await Promise.all([pool.end(), clickhouse.close()]); }
  };
}
