import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const identities = {
  admin: { nats: 'admin' },
  ingestion: { nats: 'ingestion', agent: true },
  'event-store': { nats: 'event_store', postgres: 'event_store', clickhouse: 'event_store' },
  detection: { nats: 'detection', postgres: 'detection' },
  'incident-store': { nats: 'incident_store', postgres: 'incident_store' },
  api: { nats: 'api', postgres: 'api', clickhouse: 'api', analyst: true },
  demo: { nats: 'api', postgres: 'api', clickhouse: 'api', analyst: true, agent: true },
  console: { nats: 'api', postgres: 'api', clickhouse: 'api', console: true }
};

const set = (env, name, value) => { if (!env[name]) env[name] = value; };
const secret = (env, name, file, directory) => { if (!env[name] && !env[`${name}_FILE`]) env[`${name}_FILE`] = resolve(directory, file); };

export function localEnvironment(service, { env = process.env, secretsDirectory = 'secrets' } = {}) {
  const identity = identities[service];
  if (!identity) throw new Error(`unknown local service: ${service}`);
  const local = { ...env, NOLEN_LOCAL_DEV: 'true' };
  if (identity.nats) { set(local, 'NATS_USER', identity.nats); secret(local, 'NATS_PASSWORD', `nats_${identity.nats}_password`, secretsDirectory); }
  if (identity.postgres) { set(local, 'POSTGRES_USER', `nolen_${identity.postgres}`); secret(local, 'POSTGRES_PASSWORD', `postgres_${identity.postgres}_password`, secretsDirectory); }
  if (identity.clickhouse) { set(local, 'CLICKHOUSE_USER', identity.clickhouse); secret(local, 'CLICKHOUSE_PASSWORD', `clickhouse_${identity.clickhouse}_password`, secretsDirectory); }
  if (identity.agent) secret(local, 'NOLEN_AGENT_TOKEN', 'agent_token', secretsDirectory);
  if (identity.analyst) secret(local, 'NOLEN_ANALYST_TOKEN', 'analyst_token', secretsDirectory);
  if (identity.console) { secret(local, 'NOLEN_CONSOLE_ANALYST_PASSWORD', 'console_analyst_password', secretsDirectory); secret(local, 'NOLEN_CONSOLE_ADMIN_PASSWORD', 'console_admin_password', secretsDirectory); }
  return local;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [service, target, ...args] = process.argv.slice(2);
  if (!target) throw new Error('usage: node scripts/run-local-service.js <service> <module> [...args]');
  spawn(process.execPath, [target, ...args], { env: localEnvironment(service), stdio: 'inherit' }).on('exit', code => { process.exitCode = code ?? 1; });
}
