# Integration security review

**Reviewer:** Timothy, Cybersecurity & Detection Lead

**Reviewed:** 2026-07-17; original findings at `5d3e15f`, hotfix verification on the current PR branch

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

## Findings

| ID | Severity | Finding | Required resolution | Owner | Status |
|---|---|---|---|---|---|
| SEC-001 | High | Ingestion imported `validateNef`, but NEF exports `validateEvent`; the service and its integration tests could not start. | Use `validateEvent` and restore the ingestion integration test. | Nolan + Eugene | Fixed |
| SEC-002 | High | `NolenAgent.collect()` buffered raw events without calling `sanitizeEvent()`. | Sanitize before `EventBuffer.enqueue()` and test the queued value. | Nolan + Eugene | Fixed |
| SEC-003 | High | Ingestion validated and published raw events without the required second redaction pass. | Sanitize before validation/publication and pass redacted IDs as metadata. | Nolan + Eugene | Fixed |
| SEC-004 | High | The application API exposed events, incidents, agents, and incident SSE without authentication or authorization. | Default-deny access and require the `analyst` or `admin` role. | Nolan | Fixed |
| SEC-005 | Medium | Credential-file permissions and rotation/revocation procedures are not implemented or tested. | Store credentials with owner-only permissions; add rotation and revocation tests/runbook steps. | Nolan, reviewed by Timothy | Open |
| SEC-006 | Medium | Storage idempotency and service-specific least-privilege credentials are not implemented. Compose uses shared development defaults. | Enforce unique event IDs and provision separate runtime secrets before non-local deployment. | Eugene + Nolan | Open |
| SEC-007 | Medium | Console output encoding, CSP, and CSRF controls cannot be verified because the console is absent. | Add authorization and XSS/CSRF tests with the console integration. | Dillon + Nolan, reviewed by Timothy | Blocked |

## Release gate

SEC-001 through SEC-004 are closed with automated regression coverage. The remaining credential, storage, and console controls keep the build limited to isolated local development.

Re-run after fixes:

```bash
npm test
node simulations/run.js
```
