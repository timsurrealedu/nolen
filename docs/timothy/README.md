# Timothy: detection and security contribution

## Mission

Transform validated Nolen Event Format telemetry into deterministic, explainable detections and incidents while defining the security controls that protect telemetry and analyst access.

Team MVP scope is one complete SSH-compromise investigation: four detection behaviors represented by five atomic rules, one sequence rule, and one correlation. Broader detections remain post-MVP under `docs/adr/0003-team-mvp-scope-authority.md`.

## Architecture

```text
authenticated ingestion
  -> validated and redacted NEF
  -> NOLEN_EVENTS / events.raw
  -> detection-engine durable consumer
  -> YAML rule evaluation and bounded correlation state
  -> deterministic incident
  -> NOLEN_INCIDENTS / incidents.created
```

Rules under `rules/` are authoritative detection-as-code. `packages/rule-parser/` validates and loads their metadata, matching logic, grouping, thresholds, windows, sequence constraints, correlation requirements, and ATT&CK techniques. The detection consumer validates stream events again, deduplicates event IDs, maintains a bounded ten-minute correlation window, and publishes each completed incident once per process lifetime.

## Detection content

| Rule | Security meaning | ATT&CK |
|---|---|---|
| `NOLEN-SSH-001` | Ten failed SSH logins for one source, known user, and host within 60 seconds | T1110 Brute Force |
| `NOLEN-SSH-003` | Ten failed SSH logins for one source and host when no username was observed | T1110 Brute Force |
| `NOLEN-SSH-002` | Five invalid-user SSH attempts for one source and host within 60 seconds | Unmapped precursor |
| `NOLEN-PROC-001` | Elevated `bash`, `sh`, or `zsh` process | T1059.004 Unix Shell |
| `NOLEN-FILE-001` | Access or modification of selected credential/security files | T1003 OS Credential Dumping for credential access |
| `NOLEN-SEQ-001` | Successful SSH login after a matching brute-force detection | T1078 Valid Accounts |

`NOLEN-CORR-001` creates **Probable SSH Account Compromise** only when brute force, the matching successful-login sequence, and a later privileged shell share the required entities within five minutes. Confidence is deterministic: base correlation 50 + same host 10 + same user 10 + bounded window 10 = 80.

## Security decisions

- Missing usernames remain absent. Known-user and unknown-user brute force use separate grouping rules.
- Invalid-user enumeration is a precursor signal, not incorrectly mapped to exploitation of a public-facing application.
- Individual privileged-shell or sensitive-file detections are evidence, not proof of compromise.
- `/etc/passwd` and reads under `/etc/cron*` remain telemetry only. Selected credential-file access and cron modification produce detections.
- Duplicate event IDs cannot increase count windows or create duplicate storage records.
- ML labels remain external ground truth. ML enrichment cannot create, suppress, or replace deterministic incidents.
- Simulations use validated in-memory fixtures and never invoke SSH, execute commands, modify host files, or contact remote systems.

The rationale and false-positive boundaries are maintained in `docs/detection/DETECTION_DESIGN.md`, `docs/detection/ML_LABELING.md`, and `docs/adr/0001-deterministic-security-correlation.md`.

## Verification evidence

Verified on 2026-07-22:

```bash
npm test
node simulations/run.js
```

Results:

- 52 automated tests passed; zero failed, skipped, or cancelled.
- Six offline scenarios passed, including normal operations, failures-only brute force, unknown-user brute force, invalid-user enumeration, authorized maintenance, and complete SSH compromise.
- Tests cover NEF validation, redaction, rule loading, count windows, grouping, entity isolation, ordering, duplicate suppression, sequence/correlation behavior, event-by-event stream processing, storage idempotency, API authorization, and simulation label coverage.
- The complete compromise fixture produces one incident with confidence 80, three related detections, and twelve unique evidence events.

## Security review

The integration review is tracked in `docs/security/SECURITY_REVIEW.md` and summarized in `docs/detection/COVERAGE_MATRIX.md`.

Closed controls include ingestion authentication/revocation, request and batch limits, rate limiting, NEF validation, defense-in-depth redaction, application API authorization, detection deduplication, and storage event-ID idempotency with automated regression coverage.

Open release gates:

- `SEC-005`: owner-only credential storage plus rotation/revocation procedures and tests.
- `SEC-006B`: separate least-privilege identities and secrets for NATS, ClickHouse, PostgreSQL, and API services.
- `SEC-007`: production console authorization, XSS, CSP, CSRF, session, streaming, redaction, cache, and error tests.

The console gate has a complete acceptance contract in `docs/security/CONSOLE_SECURITY_ACCEPTANCE.md`.

## Residual risks and next integration work

- Live Compose verification was unavailable during the latest review because the environment lacked Compose and Docker daemon access.
- Detection sequence state is in memory. Restarting detection during an active sequence can miss the correlation; persistent state is required before reliability claims.
- Detection sequence state survives service restarts through a bounded PostgreSQL checkpoint.
- Incidents are durably published to JetStream, idempotently stored in PostgreSQL, exposed through the analyst API, and delivered through authenticated SSE.
- Runtime secrets support file mounts and fail closed outside explicit local mode. NATS, PostgreSQL, and ClickHouse use separate scoped service identities; live denial verification remains part of the Compose gate.
- The console is absent, so event-derived output encoding and browser controls remain unverified.

These limitations keep Nolen restricted to isolated local development. They are documented rather than hidden behind production-readiness claims.
