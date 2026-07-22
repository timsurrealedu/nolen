# Integration security review

**Reviewer:** Timothy, Cybersecurity & Detection Lead

**Reviewed:** 2026-07-22; original findings at `5d3e15f`, re-reviewed on `main` at `a586efb`

**Scope:** agent buffering/transport, ingestion, NEF handling, application API, Compose defaults, detection, and simulations.

## Verified controls

| Control | Evidence | Result |
|---|---|---|
| Detection ignores duplicate event IDs | `services/detection-engine/test/engine.test.js` | Pass |
| Offline simulations make no network or system changes | `simulations/scenarios.test.js` | Pass |
| NEF rejects malformed security fields | `packages/nef/test/validate.test.js` | Pass |
| Agent and ingestion redact secrets before buffering/publication | `test/nolan.integration.test.js` | Pass |
| Ingestion authenticates agents and rejects revoked or invalid NEF input | `test/nolan.integration.test.js` | Pass |
| Application API requires an analyst or admin role | `test/nolan.integration.test.js` | Pass |
| Storage rejects duplicate event IDs and releases failed claims | `services/event-store/test/store.test.js` | Pass |

## Findings

| ID | Severity | Finding | Required resolution | Owner | Status |
|---|---|---|---|---|---|
| SEC-001 | High | Ingestion imported `validateNef`, but NEF exports `validateEvent`; the service and its integration tests could not start. | Use `validateEvent` and restore the ingestion integration test. | Nolan + Eugene | Fixed |
| SEC-002 | High | `NolenAgent.collect()` buffered raw events without calling `sanitizeEvent()`. | Sanitize before `EventBuffer.enqueue()` and test the queued value. | Nolan + Eugene | Fixed |
| SEC-003 | High | Ingestion validated and published raw events without the required second redaction pass. | Sanitize before validation/publication and pass redacted IDs as metadata. | Nolan + Eugene | Fixed |
| SEC-004 | High | The application API exposed events, incidents, agents, and incident SSE without authentication or authorization. | Default-deny access and require the `analyst` or `admin` role. | Nolan | Fixed |
| SEC-005 | Medium | Credential-file permissions and rotation/revocation procedures are not implemented or tested. | Store credentials with owner-only permissions; add rotation and revocation tests/runbook steps. | Nolan, reviewed by Timothy | Open |
| SEC-006A | Medium | Storage idempotency was not implemented. | Claim each event ID through PostgreSQL before ClickHouse insertion; roll back failed claims and retain ClickHouse deduplication as defense in depth. | Eugene + Nolan | Fixed; automated unit verification passes. Live Compose verification remains pending. |
| SEC-006B | Medium | NATS, ClickHouse, PostgreSQL, and API services do not use separate least-privilege identities. Compose and service clients use shared development defaults. | Provision distinct runtime identities and secrets, remove application fallbacks outside explicit local mode, and test denied cross-service access before non-local deployment. | Eugene + Nolan, reviewed by Timothy | Open |
| SEC-007 | Medium | Console output encoding, CSP, and CSRF controls cannot be verified because the console is absent. | Add authorization and XSS/CSRF tests with the console integration. | Dillon + Nolan, reviewed by Timothy | Blocked |

## Release gate

SEC-001 through SEC-004 and SEC-006A are closed with automated regression coverage. SEC-005, SEC-006B, and SEC-007 keep the build limited to isolated local development. Storage idempotency still needs live-stack verification because this review environment has no Compose installation or Docker daemon access.

Re-run after fixes:

```bash
npm test
node simulations/run.js
```
