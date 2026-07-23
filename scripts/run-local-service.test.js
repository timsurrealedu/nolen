import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { localEnvironment } from './run-local-service.js';

test('local service environment loads least-privilege secret files without replacing explicit settings', () => {
  const api = localEnvironment('api', { env: { NATS_USER: 'override' }, secretsDirectory: '/tmp/nolen-secrets' });
  assert.equal(api.NOLEN_LOCAL_DEV, 'true');
  assert.equal(api.NATS_USER, 'override');
  assert.equal(api.NATS_PASSWORD_FILE, resolve('/tmp/nolen-secrets', 'nats_api_password'));
  assert.equal(api.POSTGRES_USER, 'nolen_api');
  assert.equal(api.CLICKHOUSE_USER, 'api');
  assert.equal(api.NOLEN_ANALYST_TOKEN_FILE, resolve('/tmp/nolen-secrets', 'analyst_token'));
});

test('local service environment rejects unknown identities', () => {
  assert.throws(() => localEnvironment('unknown', { env: {} }), /unknown local service/);
});
