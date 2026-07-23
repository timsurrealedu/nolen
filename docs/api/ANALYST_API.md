# Analyst API contract

The local analyst API listens on `http://127.0.0.1:3002` by default. Every endpoint defaults to deny and requires a bearer token whose identity has the `analyst` or `admin` role.

For local development:

```http
Authorization: Bearer local-analyst-token
```

## Search events

```http
GET /v1/events
```

Optional query parameters:

| Parameter | Meaning |
|---|---|
| `category` | NEF category: `authentication`, `process`, or `file` |
| `action` | NEF action |
| `hostId` | Exact `host.id` |
| `user` | Exact `user.name` |
| `sourceIp` | Exact `source.ip` |
| `result` | Exact event result |
| `start`, `end` | ISO-8601 timestamp bounds |
| `limit` | Positive integer, capped at 1,000 |

Successful response:

```json
{
  "events": []
}
```

## Audit stored telemetry

```http
GET /v1/audit/telemetry?limit=10000
```

`limit` is optional and must be an integer from 1 to 100,000. The endpoint reads redacted NEF telemetry from ClickHouse and returns aggregate data-quality evidence. It does not modify stored events.

Successful response shape:

```json
{
  "report_version": "1.0",
  "assessed_at": "2026-07-22T00:00:00.000Z",
  "scope": {
    "event_limit": 3,
    "source": "ClickHouse security_events FINAL"
  },
  "summary": {
    "status": "healthy",
    "event_count": 3,
    "finding_counts": {}
  },
  "profile": {
    "event_time_range": {
      "minimum": "2026-07-21T00:00:00.000Z",
      "maximum": "2026-07-22T00:00:00.000Z"
    },
    "event_categories": {
      "authentication": 3
    },
    "entity_types": {
      "known_user": 2,
      "unknown_user": 1
    },
    "canonical_entity_coverage": 1
  },
  "findings": []
}
```

Possible `summary.status` values:

| Status | UI treatment |
|---|---|
| `healthy` | All automated checks passed |
| `ready_with_warnings` | Show warnings; telemetry remains inspectable |
| `needs_attention` | Highlight high-severity integrity or clock issues |
| `blocked` | Show critical data-quality failure and do not imply ML readiness |

Errors:

| HTTP status | Body | Meaning |
|---|---|---|
| `400` | `{ "error": "invalid_audit_limit" }` | Invalid `limit` |
| `401` | `{ "error": "authentication_required" }` | Missing or invalid token |
| `403` | `{ "error": "forbidden" }` | Authenticated role is not analyst/admin |
| `503` | `{ "error": "telemetry_audit_unavailable" }` | API was started without the audit repository |
| `500` | `{ "error": "telemetry_audit_failed" }` | ClickHouse query or report construction failed |

## Other current endpoints

- `GET /v1/incidents?limit=100` (PostgreSQL-backed; `limit` is 1–1,000)
- `GET /v1/agents`
- `GET /v1/stream/incidents` (server-sent events)

New incidents are also delivered through the authenticated SSE endpoint after JetStream delivery. The audit endpoint is read-only and advisory; it does not create, suppress, or change security incidents.

## ML shadow enrichment

`GET /v1/ml/shadow-enrichment?limit=50` returns a read-only ML advisory report. It returns `503` until `npm run ml:pipeline` has generated the local report. It cannot create, suppress, close, reprioritize, or modify deterministic incidents.
