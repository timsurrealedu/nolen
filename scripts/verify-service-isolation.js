import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { createClient } from '@clickhouse/client';
import { connect, JSONCodec } from 'nats';

const secret = async name => (await readFile(`secrets/${name}`, 'utf8')).trim();
const denied = async (name, action) => { try { await action(); throw new Error(`${name} unexpectedly allowed`); } catch (error) { if (error.message.endsWith('unexpectedly allowed')) throw error; } };
const pg = async (user, query) => { const pool = new Pool({ host: '127.0.0.1', database: 'nolen', user: `nolen_${user}`, password: await secret(`postgres_${user}_password`) }); try { return await pool.query(query); } finally { await pool.end(); } };
const clickhouse = async (user, action) => { const client = createClient({ url: 'http://127.0.0.1:8123', username: user, password: await secret(`clickhouse_${user}_password`) }); try { return await action(client); } finally { await client.close(); } };

await pg('api', 'SELECT count(*) FROM incidents');
await denied('PostgreSQL API identity reading detection state', () => pg('api', 'SELECT * FROM detection_sequence_state'));
await pg('event_store', 'SELECT count(*) FROM ingested_event_ids');
await denied('PostgreSQL event-store identity reading incidents', () => pg('event_store', 'SELECT * FROM incidents'));
await pg('detection', 'SELECT count(*) FROM detection_sequence_state');
await denied('PostgreSQL detection identity reading incidents', () => pg('detection', 'SELECT * FROM incidents'));
await pg('incident_store', 'SELECT count(*) FROM incidents');
await denied('PostgreSQL incident-store identity reading detection state', () => pg('incident_store', 'SELECT * FROM detection_sequence_state'));

await clickhouse('event_store', client => client.command({ query: "INSERT INTO security_events (event_id,event_timestamp,nef_version,host_id,category,action,raw_nef) VALUES ('isolation-check','2026-07-22 00:00:00.000','1.0','isolation-host','process','start','{}')" }));
await denied('ClickHouse event-store identity reading events', () => clickhouse('event_store', client => client.query({ query: 'SELECT count() FROM security_events' })));
await clickhouse('api', async client => { const result = await client.query({ query: "SELECT count() AS count FROM security_events WHERE event_id='isolation-check'", format: 'JSONEachRow' }); if ((await result.json())[0].count !== '1') throw new Error('ClickHouse API identity could not read inserted event'); });
await denied('ClickHouse API identity inserting events', () => clickhouse('api', client => client.command({ query: "INSERT INTO security_events (event_id,event_timestamp,nef_version,host_id,category,action,raw_nef) VALUES ('forbidden','2026-07-22 00:00:00.000','1.0','host','process','start','{}')" })));

const codec = JSONCodec();
const nats = async (user, subject, value) => { const connection = await connect({ servers: 'nats://127.0.0.1:4222', user, pass: await secret(`nats_${user}_password`) }); try { await connection.jetstream().publish(subject, codec.encode(value), { timeout: 1000 }); } finally { await connection.close(); } };
const checkEvent = { nef_version: '1.0', id: `isolation-${Date.now()}`, timestamp: new Date().toISOString(), host: { id: 'isolation-host' }, event: { category: 'process', action: 'start' }, user: { name: 'isolation' }, process: { name: 'true', pid: 1, privilege: 'standard' } };
const checkIncident = { id: `isolation-${Date.now()}`, title: 'Isolation check', createdAt: new Date().toISOString(), severity: 'low', status: 'open' };
await nats('ingestion', 'events.raw', { event: checkEvent, agentId: 'isolation-agent' });
await denied('NATS ingestion identity publishing incidents', () => nats('ingestion', 'incidents.created', checkIncident));
await nats('detection', 'incidents.created', checkIncident);
await denied('NATS API identity publishing events', () => nats('api', 'events.raw', { event: checkEvent, agentId: 'isolation-agent' }));

console.log('Least-privilege service identity verification passed.');
