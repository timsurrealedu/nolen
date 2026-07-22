# ADR 0002: Durable event storage and idempotency

## Status

Accepted for the local MVP.

## Decision

Validated and redacted events are published to the JetStream subject `events.raw`. The `NOLEN_EVENTS` stream persists that subject. The event-store service owns the durable `event-store` pull consumer and acknowledges a message only after persistence succeeds.

PostgreSQL is the idempotency ledger. `ingested_event_ids.event_id` is unique. The event store inserts a claim before writing to ClickHouse; a conflicting claim means the message is a duplicate and can be acknowledged safely. A failed ClickHouse write rolls back the PostgreSQL claim so JetStream can redeliver it.

ClickHouse stores the redacted, searchable event record. It uses `ReplacingMergeTree` ordered by `event_id` as a second line of defence for the small crash window after a ClickHouse write and before the PostgreSQL transaction commits. Search queries use `FINAL` until a later compaction strategy is introduced.

## Consequences

- The system is at-least-once from agent to JetStream and idempotent at storage.
- Detection receives events through its own `detection-engine` durable consumer and publishes deduplicated incidents to the `NOLEN_INCIDENTS` stream. Real-time and persistent incident consumers remain separate integration work.
- This uses a local single-node JetStream/PostgreSQL/ClickHouse deployment and is not a high-availability design.
