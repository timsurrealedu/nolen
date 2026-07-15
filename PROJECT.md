# Nolen MVP working contract

This document records the agreed Timothy-to-Eugene integration contract. It is the source of truth until replaced by a versioned ADR or NEF revision.

## NEF and redaction

- All events require `nef_version`, `id`, UTC ISO-8601 `timestamp`, `host.id`, `event.category`, and `event.action`.
- Authentication events are SSH events in the MVP and require `event.result`, `service.name=ssh`, and `source.ip`. A successful login also requires `user.name`.
- Process events require a name, PID, user, and explicit privilege of `standard`, `elevated`, or `unknown`.
- File events require a path and action of `access` or `modify`.
- Unknown values are omitted; they are never invented. `process.privilege=unknown` is the single explicit exception.
- The agent redacts command-line secrets before local buffering or transport. Ingestion repeats redaction before persistence and records that it changed an event without logging the secret.

## Detection and file policy

- SSH brute force has two rules: known-user grouping uses source IP, username, and host; unknown-user grouping uses source IP and host only. Missing usernames are never coerced to an empty string.
- The compromise incident explicitly requires a brute-force detection, a success-after-brute-force detection, and a privileged-shell detection on the same host and successful-login user within five minutes.
- Invalid-user SSH attempts are an unmapped account-enumeration precursor signal for MVP.
- `/etc/passwd` is telemetry only. `/etc/shadow`, `/etc/sudoers`, and `authorized_keys` are sensitive access targets. `/etc/cron*` is detected only when modified.

## ML policy

ML labels are external ground truth, never NEF fields. A five-minute entity window is malicious when it contains `brute_force`, `successful_compromise`, or `privileged_activity`; otherwise it is normal. Train/test partitions are separated by time and scenario, never random events.
