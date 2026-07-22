# Nolen MVP threat model

## Scope

One Ubuntu test endpoint sends authenticated NEF batches to a local Nolen deployment. The MVP protects telemetry integrity, availability, and analyst access; it does not promise protection from a fully compromised host.

## Assets and trust boundaries

| Asset | Boundary | Primary controls |
|---|---|---|
| Agent credential and enrollment identity | endpoint -> ingestion API | scoped credential, TLS in deployment, revocation, secret-file permissions |
| NEF events and evidence | agent -> ingestion -> NATS -> stores | schema validation, stable IDs, authenticated producer, duplicate handling |
| Detection and incident data | detection service -> PostgreSQL/API | service authorization, append-only evidence IDs, audit status changes |
| SOC session and console | browser -> application API | authenticated users, role checks, secure cookies/tokens, output encoding; verified by `docs/security/CONSOLE_SECURITY_ACCEPTANCE.md` |

## Threats and MVP mitigations

| Threat | Risk | Required mitigation | Verification |
|---|---|---|---|
| Forged telemetry | false incidents or hidden activity | authenticate the agent; bind identity to host; validate NEF; reject unknown/revoked agents | invalid/unknown credential integration test |
| Replay or duplicate batches | inflated counts/incidents | stable event IDs; idempotent storage; detection counts unique IDs only | duplicate-delivery test |
| Event flooding | ingestion/storage exhaustion | request and batch-size limits, per-agent rate limits, backpressure, audit rejected requests | oversized/rate-limit test |
| Compromised agent | attacker sends plausible events or steals credential | revocation, credential rotation, least-privilege agent account, heartbeat anomaly review | revoked-agent test and runbook |
| Sensitive telemetry exposure | credentials, command lines, paths, IPs disclosed | TLS, restricted database/API access, redact secrets from logs/UI, retention policy | log/UI review |
| Stream/storage tampering | lost or altered evidence | authenticated service accounts, durable acknowledgements, backups, append-only event IDs | consumer restart and reconciliation test |
| Console compromise | unauthorized incident/evidence access or XSS | authentication/authorization, CSP, output encoding, CSRF protection for state changes | authorization and XSS review |
| Unsafe simulation | accidental attacks outside lab | local-only scripts, no external targets, explicit safeguards | script test and code review |

## Residual risks

- A root-compromised endpoint can forge or suppress telemetry.
- The local MVP does not provide high availability, hardware-backed keys, or full forensic integrity guarantees.
- File-access collection is best effort and must be labelled as such when unavailable.

## Security acceptance criteria

- Agent/API tests cover authentication, revocation, request/batch limits, rate limiting, invalid NEF, and duplicate IDs.
- Detection evidence stores event IDs only; raw event retrieval remains authorization-gated.
- Logs never contain enrollment secrets, authorization headers, passwords, or complete sensitive command lines.
- The simulation runs only against supplied local fixtures and never opens network connections.
