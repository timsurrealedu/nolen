import { createClient } from '@clickhouse/client';
import { Pool } from 'pg';
import { createPostgresLedger } from './ledger.js';

export const createPostgresPool = ({ postgresUrl }) => new Pool({ connectionString: postgresUrl });

export function createStorageClients({ postgresUrl, clickhouseUrl }) {
  const pool = createPostgresPool({ postgresUrl });
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
