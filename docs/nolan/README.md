# Nolan — Software & Integration

Nolan owns the dependable path from endpoint activity to analyst-facing APIs.

## Components

- `agent/`: durable JSONL buffering and authenticated batched HTTP delivery. Events are removed only after acknowledged IDs, yielding at-least-once delivery; downstream services must deduplicate by NEF event ID.
- `apps/ingestion/`: token-authenticated batch endpoint with revoked-agent enforcement, request/batch limits, NEF validation, and a pluggable stream publisher.
- `apps/api/`: event, incident, and endpoint read APIs plus an SSE endpoint for critical incidents.
- `docker-compose.yml`: local Postgres, NATS JetStream, and ClickHouse service skeletons with health checks.

## Security decisions

Agent credentials are supplied through runtime configuration, never embedded in events. Invalid telemetry is rejected before publication. The ingestion boundary limits payload size, batch size, and requests per agent. Console authentication and persistent repositories are the next integration adapters; they are deliberately not faked by this in-memory MVP.

## Verification

Run `npm test`. The integration test proves durable buffering, authenticated batch delivery, acknowledgment-based removal, validation, and revoked-agent rejection.
