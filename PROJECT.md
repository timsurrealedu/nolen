# Nolen MVP working contract

This document records the agreed Timothy-to-Eugene integration contract. It is the source of truth until replaced by a versioned ADR or NEF revision.

## Commands

- `npm test`: full repository test suite.
- `node services/detection-engine/test/engine.test.js`: detailed detection checks.
- `node simulations/run.js`: validate and evaluate every offline security scenario; exits non-zero on a mismatch.

## NEF and redaction

- All events require `nef_version`, `id`, UTC ISO-8601 `timestamp`, `host.id`, `event.category`, and `event.action`.
- Authentication events are SSH events in the MVP and require `event.result`, `service.name=ssh`, and `source.ip`. A successful login also requires `user.name`.
- Process events require a name, PID, user, and explicit privilege of `standard`, `elevated`, or `unknown`.
- File events require a path and action of `access` or `modify`.
- Unknown values are omitted; they are never invented. `process.privilege=unknown` is the single explicit exception.
- The agent redacts command-line secrets before local buffering or transport. Ingestion repeats redaction before persistence and records that it changed an event without logging the secret.
- Ingestion passes redaction audit metadata to publishers as `{ redactedEventIds }`; the IDs contain no secret values.
- Application event, incident, agent, and incident-stream endpoints default deny and require a bearer-token identity with role `analyst` or `admin`.

## Detection and file policy

- SSH brute force has two rules: known-user grouping uses source IP, username, and host; unknown-user grouping uses source IP and host only. Missing usernames are never coerced to an empty string.
- Count rules evaluate any qualifying window in the batch; later events cannot erase an earlier match. Duplicate IDs and separate entities never combine toward a threshold.
- The compromise incident explicitly requires a brute-force detection, a success-after-brute-force detection, and a later privileged-shell detection on the same host and successful-login user within five minutes.
- Invalid-user SSH attempts are an unmapped account-enumeration precursor signal for MVP.
- `/etc/passwd` is telemetry only. `/etc/shadow`, `/etc/sudoers`, and `authorized_keys` are sensitive access targets. `/etc/cron*` is detected only when modified.

## ML policy

ML labels are external ground truth, never NEF fields. A five-minute entity window is malicious when it contains `brute_force`, `successful_compromise`, or `privileged_activity`; otherwise it is normal. Train/test partitions are separated by time and scenario, never random events.

## Simulation policy

- Simulations construct validated in-memory NEF fixtures only; no SSH, shell execution, file mutation, or network request.
- `simulations/labels.csv` has exactly one external label per unique fixture event.
- Authorized maintenance may trigger privileged-shell or sensitive-file detections without creating a compromise incident; individual rule matches are evidence, not proof of malicious activity.
