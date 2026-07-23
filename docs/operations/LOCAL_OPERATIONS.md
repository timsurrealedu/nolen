# Local operations

## Start local infrastructure

```bash
NOLEN_LOCAL_DEV=true npm run secrets:init
docker compose up -d
npm run migrate:local:messaging
```

Compose initializes schemas and least-privilege identities on a new data directory. Host processes must use each service's `NATS_USER`, `NATS_PASSWORD_FILE`, `POSTGRES_USER`, `POSTGRES_PASSWORD_FILE`, `CLICKHOUSE_USER`, and `CLICKHOUSE_PASSWORD_FILE`. Production mode has no credential fallbacks. Use the NATS `admin` identity only for `npm run migrate:messaging`.

Run these long-lived services in separate terminals. The `local` commands read generated password files and retain the least-privilege Compose identities:

```bash
npm run start:local:ingestion
npm run start:local:event-store
npm run start:local:detection
npm run start:local:incident-store
npm run start:local:api
npm run build:console
npm run start:local:console
```

## Health and telemetry audit

```bash
npm run health:local
npm run audit:event-store
```

The health command checks PostgreSQL, ClickHouse, and NATS without changing data. The telemetry audit reads a bounded sample of redacted NEF records from ClickHouse and reports NEF validity, event mix, future timestamps, duplicate IDs, and canonical ML-entity coverage.

The same read-only report is available to an authenticated analyst through `GET /v1/audit/telemetry?limit=10000` with `Bearer local-analyst-token`. This is an API for a future dashboard; it does not expose raw agent credentials or modify stored telemetry.

## End-to-end demo

After all services above are running:

```bash
npm run demo:local
```

It sends one harmless synthetic failed-SSH event to local ingestion, waits for NATS/event-store persistence, then verifies that the analyst API can retrieve the same event. It uses the local development tokens and does not connect to remote hosts.

The detection consumer checkpoints its bounded ten-minute correlation window and published-incident suppression state in PostgreSQL before acknowledging each event. The incident-store consumer writes incidents idempotently to PostgreSQL. The API reads those records and forwards new incidents to authenticated SSE clients.

## Security verification

```bash
npm run test:console-security
npm run verify:service-isolation
npm run verify:live-incident
npm run verify:live-console
```

The isolation and live commands require the Compose services and generated local secrets. `verify:live-incident` accepts `precursor`, `complete`, and `verify` phases plus a shared run ID for explicit restart testing.

## Retention preview

```bash
npm run retention:preview
```

This is read-only: it reports how many events would be older than the default 90-day retention window. It does not delete any data. Enforcing a retention policy requires a team decision on duration, legal/privacy requirements, and backup handling.
