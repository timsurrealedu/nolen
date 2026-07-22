import { readFile } from 'node:fs/promises';

export async function configValue(name, { env = process.env, localFallback } = {}) {
  const fileName = env[`${name}_FILE`];
  if (env[name] && fileName) throw new Error(`${name} and ${name}_FILE are mutually exclusive`);
  const value = fileName ? (await readFile(fileName, 'utf8')).trim() : env[name];
  if (value) return value;
  if (env.NOLEN_LOCAL_DEV === 'true' && localFallback !== undefined) return localFallback;
  throw new Error(`${name} or ${name}_FILE is required`);
}

export async function loadNatsConfig(options = {}) {
  const env = options.env ?? process.env;
  const servers = await configValue('NATS_URL', { ...options, localFallback: 'nats://127.0.0.1:4222' });
  if (env.NOLEN_LOCAL_DEV === 'true' && !env.NATS_USER && !env.NATS_USER_FILE) return { servers };
  return { servers, user: await configValue('NATS_USER', options), pass: await configValue('NATS_PASSWORD', options) };
}

export async function loadPostgresConfig(options = {}) {
  const env = options.env ?? process.env;
  const postgresUrl = env.POSTGRES_URL || env.POSTGRES_URL_FILE
    ? await configValue('POSTGRES_URL', options)
    : env.POSTGRES_USER
      ? `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(await configValue('POSTGRES_PASSWORD', options))}@${env.POSTGRES_HOST ?? '127.0.0.1'}:${env.POSTGRES_PORT ?? '5432'}/${env.POSTGRES_DB ?? 'nolen'}`
      : await configValue('POSTGRES_URL', { ...options, localFallback: 'postgres://postgres:nolen@127.0.0.1:5432/nolen' });
  return { postgresUrl };
}

export async function loadClickHouseConfig(options = {}) {
  const env = options.env ?? process.env;
  const clickhouseUrl = env.CLICKHOUSE_URL || env.CLICKHOUSE_URL_FILE
    ? await configValue('CLICKHOUSE_URL', options)
    : env.CLICKHOUSE_USER
      ? `http://${encodeURIComponent(env.CLICKHOUSE_USER)}:${encodeURIComponent(await configValue('CLICKHOUSE_PASSWORD', options))}@${env.CLICKHOUSE_HOST ?? '127.0.0.1'}:${env.CLICKHOUSE_PORT ?? '8123'}`
      : await configValue('CLICKHOUSE_URL', { ...options, localFallback: 'http://127.0.0.1:8123' });
  return { clickhouseUrl };
}

export async function loadStorageConfig(options = {}) {
  return { ...await loadPostgresConfig(options), ...await loadClickHouseConfig(options) };
}
