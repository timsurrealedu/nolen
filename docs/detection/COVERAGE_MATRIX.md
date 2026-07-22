# Timothy security delivery matrix

| Deliverable | Location | Evidence |
|---|---|---|
| Threat model | `docs/threat-model/THREAT_MODEL.md` | threats, trust boundaries, controls, residual risk |
| Telemetry requirements | `docs/specs/telemetry-security-requirements.md` | required evidence and redaction constraints |
| Detection content | `rules/` | four behaviors represented by five atomic rules, one sequence rule, one correlation rule |
| ATT&CK rationale/confidence | `docs/detection/DETECTION_DESIGN.md` | mappings and deterministic confidence=80 |
| Correlation implementation | `services/detection-engine/src/engine.js` | evidence IDs, entities, ATT&CK fields |
| Safe simulation | `simulations/` | validated offline scenario matrix; no network or system mutation |
| Automated checks | `services/detection-engine/test/engine.test.js`, `simulations/scenarios.test.js` | rules, windows, entity isolation, ordering, false positives, NEF validity, label coverage |
| Security review | `docs/security/SECURITY_REVIEW.md` | verified controls, findings, owners, and release gate |
| Correlation decision | `docs/adr/0001-deterministic-security-correlation.md` | proposed deterministic evidence and confidence contract |
| Portfolio contribution | `docs/timothy/README.md` | architecture, decisions, verification evidence, findings, and residual risks |

## Integration security review checklist

- [x] Agent credential is stored in an atomic owner-only file, omitted from serialization/logs, and covered by rotation/revocation tests and runbook. (`SEC-005`)
- [x] Ingestion authenticates agent identity, rejects revoked identities, limits batch/request size, and rate-limits per identity.
- [x] NEF validation and defense-in-depth redaction occur before stream publication; validation errors contain no secrets.
- [x] Storage claims unique event IDs before ClickHouse insertion, rolls back failed claims, and detection independently deduplicates event IDs. Automated tests pass; live Compose verification remains pending. (`SEC-006A`)
- [x] API authorizes raw evidence retrieval; incident-status updates are not yet implemented.
- [x] Console passes production-build authorization, XSS, CSP, CSRF, session, streaming, redaction, cache, error, keyboard, and responsive tests. (`SEC-007`)
- [x] Command-line redaction is applied before local buffering and stream publication. Display verification remains blocked by `SEC-007`.
- [x] NATS, ClickHouse, PostgreSQL, and API service credentials are separate, file-backed, least-privileged, and live cross-service denials pass. (`SEC-006B`)
