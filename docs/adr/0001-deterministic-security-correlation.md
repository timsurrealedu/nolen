# ADR 0001: Deterministic security correlation

- Status: Proposed
- Owner: Timothy
- Reviewers: Eugene, Nolan
- Date: 2026-07-16

## Context

Nolen must create explainable incidents when ML is unavailable. The SSH-compromise story needs stable entity, ordering, time-window, evidence, and confidence semantics across detection, storage, and API boundaries.

## Decision

`NOLEN-CORR-001` requires, in order:

1. `NOLEN-SSH-001` or `NOLEN-SSH-003` brute-force evidence.
2. `NOLEN-SEQ-001` successful SSH login from the same source and host.
3. `NOLEN-PROC-001` privileged shell for the same host and successful-login user within five minutes.

The incident stores the three detection IDs, unique evidence event IDs, affected entities, ATT&CK techniques, and status `open`. Confidence is fixed at 80: base match 50, same host 10, same user 10, five-minute window 10. ML may enrich priority but cannot create or suppress this incident.

## Consequences

- Results are reproducible and testable without external services.
- Every incident has an auditable evidence path.
- New correlation signals require a versioned rule, rationale, fixtures, and tests.
- Batch-local state does not survive a detection-engine restart; persistent window state is a later integration decision and must preserve these semantics.
