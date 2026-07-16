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

## Integration security review checklist

- [ ] Agent credential is stored with owner-only permissions and never logged.
- [ ] Ingestion authenticates agent identity, rejects revoked identities, limits batch/request size, and rate-limits per identity.
- [ ] NEF validation occurs before stream publication; validation errors contain no secrets.
- [ ] Storage enforces event-ID idempotency and detection receives unique IDs.
- [ ] API authorizes raw evidence retrieval and incident-status updates.
- [ ] Console escapes all event-derived fields and protects state-changing requests.
- [ ] Command-line and sensitive-field redaction is applied before persistence and display.
- [ ] NATS, ClickHouse, PostgreSQL, and API service credentials are separate and least-privileged.
