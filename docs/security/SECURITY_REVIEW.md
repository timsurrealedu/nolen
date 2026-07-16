# Integration security review

**Reviewer:** Timothy, Cybersecurity & Detection Lead

**Reviewed:** 2026-07-16 at `5d3e15f`

**Scope:** agent buffering/transport, ingestion, NEF handling, application API, Compose defaults, detection, and simulations.

## Verified controls

| Control | Evidence | Result |
|---|---|---|
| Detection ignores duplicate event IDs | `services/detection-engine/test/engine.test.js` | Pass |
| Offline simulations make no network or system changes | `simulations/scenarios.test.js` | Pass |
| NEF rejects malformed security fields | `packages/nef/test/validate.test.js` | Pass |
| Redaction helper removes tested command-line secrets | `packages/nef/test/validate.test.js` | Pass, not integrated |
| Ingestion checks agent tokens, revocation, batch size, and per-agent request rate | `apps/ingestion/src/server.js` | Code review only; runtime blocked by SEC-001 |

## Findings

| ID | Severity | Finding | Required resolution | Owner | Status |
|---|---|---|---|---|---|
| SEC-001 | High | Ingestion imports `validateNef`, but NEF exports `validateEvent`; the service and its integration tests cannot start. | Agree one API name and restore the ingestion integration test. | Nolan + Eugene | Open |
| SEC-002 | High | `NolenAgent.collect()` buffers raw events without calling `sanitizeEvent()`. Secrets can reach the local queue. | Sanitize before `EventBuffer.enqueue()` and test that the queue never contains the original secret. | Nolan + Eugene | Open |
| SEC-003 | High | Ingestion validates and publishes raw events without applying the required second redaction pass. | Sanitize before validation/publication and record only a redaction flag. | Nolan + Eugene | Open |
| SEC-004 | High | The application API exposes events, incidents, agents, and incident SSE without authentication or authorization. | Require an authenticated analyst and authorize raw evidence and state-changing operations. | Nolan | Open |
| SEC-005 | Medium | Credential-file permissions and rotation/revocation procedures are not implemented or tested. | Store credentials with owner-only permissions; add rotation and revocation tests/runbook steps. | Nolan, reviewed by Timothy | Open |
| SEC-006 | Medium | Storage idempotency and service-specific least-privilege credentials are not implemented. Compose uses shared development defaults. | Enforce unique event IDs and provision separate runtime secrets before non-local deployment. | Eugene + Nolan | Open |
| SEC-007 | Medium | Console output encoding, CSP, and CSRF controls cannot be verified because the console is absent. | Add authorization and XSS/CSRF tests with the console integration. | Dillon + Nolan, reviewed by Timothy | Blocked |

## Release gate

The current build is suitable only for local development with offline simulations. SEC-001 through SEC-004 must be closed before an end-to-end security demo or any deployment beyond an isolated developer environment.

Re-run after fixes:

```bash
npm test
node simulations/run.js
```
