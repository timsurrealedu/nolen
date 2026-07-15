# Timothy's telemetry security requirements

These requirements approve the security meaning of NEF fields. Eugene owns schema implementation; Nolan owns collection and transport.

## SSH authentication

Required: `id`, `timestamp`, `host.id`, `host.name`, `event.category=authentication`, `event.action=login`, `event.result`, `service.name=ssh`.

- Failures must include `source.ip` when known.
- Invalid-user events must include `user.name` when parsed and retain `event.action=invalid_user`.
- Successes must include `user.name`; `source.ip` is required when the source is remote.
- Timestamps are UTC ISO-8601. Event IDs are stable across retry.

## Process telemetry

Required: `id`, `timestamp`, `host.id`, `event.category=process`, `event.action=start`, `process.name`, `process.pid`, `user.name`.

- Include `process.parent_pid`, command line, and `process.privilege` where available.
- `process.privilege=elevated` means the process has effective UID 0 or an equivalent confirmed privileged context; do not infer it from the command name.

## Sensitive file telemetry

Required: `id`, `timestamp`, `host.id`, `event.category=file`, `event.action=access`, `file.path`, `user.name` when known.

- MVP sensitivity targets: `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`, `/etc/cron*`, and user `~/.ssh/authorized_keys`.
- Emit only actual observed access. If reliable observation is unavailable, report capability status rather than synthesizing events.

## Handling rules

- Never place passwords, private keys, auth headers, or file contents in NEF.
- Command lines may contain secrets; agent, ingestion, and console must support redaction before persistence/display.
- Unknown values must be omitted, not replaced with fabricated values.
