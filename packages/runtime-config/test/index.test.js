import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configValue, loadNatsConfig, loadStorageConfig } from '../src/index.js';

test('loads secret files and rejects ambiguous sources', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'nolen-config-')), 'secret');
  await writeFile(path, 'file-secret\n');
  assert.equal(await configValue('TOKEN', { env: { TOKEN_FILE: path } }), 'file-secret');
  await assert.rejects(configValue('TOKEN', { env: { TOKEN: 'direct', TOKEN_FILE: path } }), /mutually exclusive/);
});

test('allows fallbacks only in explicit local development', async () => {
  await assert.rejects(configValue('TOKEN', { env: {}, localFallback: 'unsafe' }), /required/);
  assert.equal(await configValue('TOKEN', { env: { NOLEN_LOCAL_DEV: 'true' }, localFallback: 'local' }), 'local');
  assert.deepEqual(await loadNatsConfig({ env: { NOLEN_LOCAL_DEV: 'true' } }), { servers: 'nats://127.0.0.1:4222' });
});

test('builds encoded service-specific storage credentials', async () => {
  const config = await loadStorageConfig({ env: {
    POSTGRES_USER: 'nolen_api', POSTGRES_PASSWORD: 'p@ss', POSTGRES_HOST: 'postgres',
    CLICKHOUSE_USER: 'api', CLICKHOUSE_PASSWORD: 'read only', CLICKHOUSE_HOST: 'clickhouse'
  } });
  assert.equal(config.postgresUrl, 'postgres://nolen_api:p%40ss@postgres:5432/nolen');
  assert.equal(config.clickhouseUrl, 'http://api:read%20only@clickhouse:8123');
});
