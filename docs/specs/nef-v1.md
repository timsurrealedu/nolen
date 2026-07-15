# Nolen Event Format (NEF) v1

## Purpose

NEF is the versioned event contract exchanged by the Nolen agent, ingestion service, data platform, detection engine, and SOC console. This MVP supports `authentication`, `process`, and `file` events.

The machine-readable contract is [`packages/nef/schema/nef-v1.schema.json`](../../packages/nef/schema/nef-v1.schema.json). Unknown values are omitted rather than fabricated.

## Common fields

| Field | Requirement | Notes |
|---|---|---|
| `nef_version` | required | Must be `1.0`. |
| `id` | required | Stable, non-empty event ID generated once before retries. Storage deduplicates by this value. |
| `timestamp` | required | UTC ISO-8601/RFC 3339 timestamp. |
| `host.id` | required | Stable Nolen host identity. |
| `host.name` | optional | Human-readable hostname. |
| `agent.id` | optional | Enrolled agent identity. |
| `observer.*` | optional | Collector metadata. |
| `event.category` | required | `authentication`, `process`, or `file`. |
| `event.action` | required | Category-specific action listed below. |

## Authentication events

The MVP only supports SSH authentication.

| Field | Requirement |
|---|---|
| `event.category` | `authentication` |
| `event.action` | `login` or `invalid_user` |
| `event.result` | `success` or `failure` |
| `service.name` | `ssh` |
| `source.ip` | required valid IPv4 or IPv6 address |
| `user.name` | required for successful `login`; optional otherwise |

The known-user brute-force rule uses `source.ip + user.name + host.id`. The unknown-user rule applies only when `user.name` is absent and uses `source.ip + host.id`.

## Process events

| Field | Requirement |
|---|---|
| `event.category` | `process` |
| `event.action` | `start` |
| `process.name` | required |
| `process.pid` | required non-negative integer |
| `process.privilege` | required: `standard`, `elevated`, or `unknown` |
| `user.name` | required |
| `process.parent_pid`, `process.command_line`, `process.args`, `process.parent_command_line` | optional |

`elevated` means an observed effective UID of 0 or equivalent confirmed privileged context. It must not be inferred from a command name.

## File events

| Field | Requirement |
|---|---|
| `event.category` | `file` |
| `event.action` | `access` or `modify` |
| `file.path` | required absolute path |
| `user.name`, `process.name`, `process.pid` | optional |

`/etc/passwd` is collected as telemetry only. Access to `/etc/shadow`, `/etc/sudoers`, and `~/.ssh/authorized_keys` is security-sensitive. `/etc/cron*` becomes security-sensitive only for `modify` events.

## Redaction and delivery

Before local buffering, the agent redacts secrets in `process.command_line`, `process.args`, and `process.parent_command_line`. Ingestion repeats the sanitization before persistence as defense in depth. The redactor preserves executable names and harmless argument structure while replacing secret values with `[REDACTED]`.

It must recognize password-like fields, tokens, API keys, authorization and bearer headers, password command flags, URL user-info, and PEM/private-key blocks. Secrets must never appear in logs, buffers, streams, storage, or the console.

Events are delivered at least once where practical. Consumers and storage must use `id` for idempotency.
