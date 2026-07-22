import { connect } from 'nats';
import { createStorageClients } from '../services/event-store/src/clients.js';
import { loadNatsConfig, loadStorageConfig } from '../packages/runtime-config/src/index.js';

export async function checkLocalServices({ clients, connectNats = connect, natsOptions } = {}) {
  clients ??= createStorageClients(await loadStorageConfig());
  const checks = {};
  try {
    await clients.pool.query('SELECT 1');
    checks.postgres = 'healthy';
  } catch (error) { checks.postgres = `unhealthy: ${error.message}`; }
  try {
    const result = await clients.clickhouse.query({ query: 'SELECT 1 AS ok', format: 'JSONEachRow' });
    await result.json();
    checks.clickhouse = 'healthy';
  } catch (error) { checks.clickhouse = `unhealthy: ${error.message}`; }
  try {
    const connection = await connectNats(natsOptions ?? await loadNatsConfig());
    await connection.drain();
    checks.nats = 'healthy';
  } catch (error) { checks.nats = `unhealthy: ${error.message}`; }
  await clients.close?.();
  return { status: Object.values(checks).every(value => value === 'healthy') ? 'healthy' : 'unhealthy', checks };
}

if (process.argv[1]?.endsWith('health-services.js')) {
  const report = await checkLocalServices();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'healthy') process.exitCode = 1;
}
