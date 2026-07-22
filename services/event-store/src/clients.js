import { createClient } from '@clickhouse/client';
import { Pool } from 'pg';
import { createPostgresLedger } from './ledger.js';

export function createStorageClients({ postgresUrl, clickhouseUrl }) {
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
