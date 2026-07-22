# Local operations

## Start local infrastructure

```bash
docker compose up -d
npm run migrate:storage
```

Run these three long-lived services in separate terminals:

```bash
npm run start:ingestion
npm run start:event-store
npm run start:api
```

## Health and telemetry audit

```bash
npm run health:services
npm run audit:event-store
```

The health command checks PostgreSQL, ClickHouse, and NATS without changing data. The telemetry audit reads a bounded sample of redacted NEF records from ClickHouse and reports NEF validity, event mix, future timestamps, duplicate IDs, and canonical ML-entity coverage.

## End-to-end demo

After all services above are running:

```bash
npm run demo:live
```

It sends one harmless synthetic failed-SSH event to local ingestion, waits for NATS/event-store persistence, then verifies that the analyst API can retrieve the same event. It uses the local development tokens and does not connect to remote hosts.

## Retention preview

```bash
npm run retention:preview
```

This is read-only: it reports how many events would be older than the default 90-day retention window. It does not delete any data. Enforcing a retention policy requires a team decision on duration, legal/privacy requirements, and backup handling.
