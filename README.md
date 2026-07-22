# Nolen

Nolen is an open-source, educational security monitoring platform that turns Linux endpoint telemetry into explainable security incidents.

Rather than presenting isolated events, Nolen connects related activity into an investigation-ready story—for example, an SSH brute-force attempt followed by successful authentication, privilege escalation, and sensitive-file access.

> Nolen turns endpoint activity into understandable security incidents.

## Status

Nolen is under active development. The current repository includes the initial detection and correlation engine, detection rules, security documentation, and a safe offline SSH-compromise simulation. It is not a production SIEM, EDR, or XDR.

## Architecture

```text
Linux endpoint
  -> Nolen Agent
  -> authenticated ingestion
  -> NATS JetStream
  -> event storage + detection/correlation
  -> API
  -> SOC console
```

All components communicate security events through **NEF (Nolen Event Format)**, the project’s normalized event contract.

## MVP scope

Team MVP scope follows `specifiedPRD.md` v2.0: four detection behaviors, represented by five atomic YAML rules because SSH brute force has known/unknown-user variants, plus one sequence rule and one SSH-compromise correlation. The larger rule and scenario set in `PRD.md` v1.0 is the post-MVP backlog.

- Linux endpoint telemetry for authentication, processes, and selected sensitive files
- Authenticated batched event ingestion with validation and retry-aware delivery
- Declarative YAML detection rules, including count-window and sequence detection
- Correlation of related detections into incidents with evidence and MITRE ATT&CK mappings
- Event search, endpoint management, real-time SOC dashboard, incident timelines, and attack graphs
- Reproducible attack simulations and automated tests

Initial scenarios include SSH account compromise, cron-based persistence, and unauthorized SSH persistence.

## Technology direction

| Area | Planned technology |
| --- | --- |
| Agent, ingestion, detection | Go |
| Event streaming | NATS JetStream |
| Event storage | ClickHouse |
| Application data | PostgreSQL |
| Detection state | Redis |
| SOC console | Next.js, TypeScript, Tailwind CSS, shadcn/ui, React Flow |
| Observability | OpenTelemetry, Prometheus, Grafana |

Technology choices may evolve; architectural changes should be captured in ADRs.

## Quick start

The current detection implementation has no external runtime dependencies.

```bash
npm test
node simulations/ssh-compromise/run.js
```

The simulation creates offline, NEF-like fixture events only. It does not make network requests, invoke SSH, execute a shell, or modify files.

## Repository map

```text
docs/                       Specifications, detection design, and threat model
rules/                      Detection and correlation rules
services/detection-engine/  Initial detection and correlation implementation
simulations/                Safe, reproducible attack scenarios
PRD.md                      Full product requirements
```

## Security principles

- Treat endpoint telemetry as sensitive data.
- Authenticate agents; reject revoked agents; encrypt transport.
- Validate and rate-limit ingestion requests.
- Redact secrets from process command lines before transmission and at ingestion.
- Keep detection and correlation deterministic, explainable, and evidence-backed.
- Design consumers for retries and duplicate event delivery.

See the [threat model](docs/threat-model/THREAT_MODEL.md) and [telemetry security requirements](docs/specs/telemetry-security-requirements.md).

## Documentation

- [Product requirements](PRD.md)
- [Detection design](docs/detection/DETECTION_DESIGN.md)
- [Detection coverage](docs/detection/COVERAGE_MATRIX.md)
- [Integration security review](docs/security/SECURITY_REVIEW.md)
- [ML labeling guidance](docs/detection/ML_LABELING.md)
- [Local operations and demo](docs/operations/LOCAL_OPERATIONS.md)
- [Analyst API contract](docs/api/ANALYST_API.md)
- [Safe SSH-compromise simulation](simulations/ssh-compromise/README.md)

## Contributing

Build against the documented contracts first—especially NEF—and add tests plus a reproducible simulation for security behavior. Do not use the project to target systems you do not own or have explicit authorization to test.
