# Timothy security delivery matrix

| Deliverable | Location | Evidence |
|---|---|---|
| Threat model | `docs/threat-model/THREAT_MODEL.md` | threats, trust boundaries, controls, residual risk |
| Telemetry requirements | `docs/specs/telemetry-security-requirements.md` | required evidence and redaction constraints |
| Detection content | `rules/` | four rules, one sequence rule, one correlation rule |
| ATT&CK rationale/confidence | `docs/detection/DETECTION_DESIGN.md` | mappings and deterministic confidence=80 |
| Correlation implementation | `services/detection-engine/src/engine.js` | evidence IDs, entities, ATT&CK fields |
| Safe simulation | `simulations/` | validated offline scenario matrix; no network or system mutation |
| Automated checks | `services/detection-engine/test/engine.test.js`, `simulations/scenarios.test.js` | rules, windows, entity isolation, ordering, false positives, NEF validity, label coverage |
| Security review | `docs/security/SECURITY_REVIEW.md` | verified controls, findings, owners, and release gate |
| Correlation decision | `docs/adr/0001-deterministic-security-correlation.md` | proposed deterministic evidence and confidence contract |

## Integration security review checklist

- [ ] Agent credential is stored with owner-only permissions and never logged. (`SEC-005`)
- [ ] Ingestion authenticates agent identity, rejects revoked identities, limits batch/request size, and rate-limits per identity. (`SEC-001` blocks runtime verification.)
- [ ] NEF validation occurs before stream publication; validation errors contain no secrets. (`SEC-001`, `SEC-003`)
- [ ] Storage enforces event-ID idempotency and detection receives unique IDs. Detection passes; storage remains open (`SEC-006`).
- [ ] API authorizes raw evidence retrieval and incident-status updates. (`SEC-004`)
- [ ] Console escapes all event-derived fields and protects state-changing requests. (`SEC-007`)
- [ ] Command-line and sensitive-field redaction is applied before persistence and display. (`SEC-002`, `SEC-003`)
- [ ] NATS, ClickHouse, PostgreSQL, and API service credentials are separate and least-privileged. (`SEC-006`)
