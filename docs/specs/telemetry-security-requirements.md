# Timothy's telemetry security requirements

These requirements approve the security meaning of NEF fields. Eugene owns schema implementation; Nolan owns collection and transport.

## SSH authentication

Required: common NEF fields, `event.category=authentication`, `event.action=login|invalid_user`, `event.result=success|failure`, `service.name=ssh`, and `source.ip`.

- Invalid-user events retain `event.action=invalid_user`; include `user.name` only when the collector observed it.
- Successful logins require `user.name`; it is optional for failures.
- Timestamps are UTC ISO-8601. Event IDs are stable across retry.

## Process telemetry

Required: common NEF fields, `event.category=process`, `event.action=start`, `process.name`, `process.pid`, `process.privilege`, and `user.name`.

- `process.privilege` is `standard`, `elevated`, or `unknown`.
- Include `process.parent_pid`, `process.command_line`, `process.args`, and `process.parent_command_line` where available.
- `process.privilege=elevated` means the process has effective UID 0 or an equivalent confirmed privileged context; do not infer it from the command name.

## Sensitive file telemetry

Required: common NEF fields, `event.category=file`, `event.action=access|modify`, and an absolute `file.path`. User and process context are optional.

- `/etc/passwd` is telemetry only.
- Access or modification of `/etc/shadow`, `/etc/sudoers`, and user `~/.ssh/authorized_keys` is security-sensitive.
- `/etc/cron*` is security-sensitive only when modified.
- Emit only actual observed access. If reliable observation is unavailable, report capability status rather than synthesizing events.

## Handling rules

- Never place passwords, private keys, authorization values, or file contents in NEF.
- Redact secrets from `process.command_line`, `process.args`, and `process.parent_command_line` before buffering or transmission; ingestion repeats redaction before persistence.
- Unknown values must be omitted, not replaced with fabricated values.
