# NOLEN

## Product Requirements Document — Team MVP

**Version:** 2.0  
**Project type:** Open-source security telemetry and incident-investigation platform  
**Team:** Eugene (Data Engineering & ML), Timothy (Cybersecurity), Dillon (UI/UX), Nolan (Software Engineering)  
**Target:** One Linux endpoint and a web-based SOC console

---

## 1. Product Summary

Nolen collects security-relevant activity from a Linux endpoint, converts it to a consistent event format, detects suspicious behaviour, and presents the supporting evidence as an understandable incident.

The MVP demonstrates one complete story:

> Repeated SSH failures from an IP address are followed by a successful login, privileged shell activity, and sensitive-file access. Nolen turns these related events into a **Probable SSH Account Compromise** incident.

Nolen is an educational and portfolio project. It is **not** a production replacement for a SIEM, EDR, or XDR platform.

---

## 2. Goals

The MVP must:

- Collect authentication and basic process telemetry from one Linux endpoint.
- Send authenticated, batched events reliably to the platform.
- Validate, stream, store, and search normalized events.
- Detect a small set of deterministic security rules.
- Correlate related detections and events into one incident.
- Show the incident, evidence, timeline, and MITRE ATT&CK mapping in a browser.
- Provide an explainable ML-based risk enrichment score in **shadow mode**.
- Run locally through a reproducible Docker Compose setup and automated demo.

The project must give every team member a clear, independently explainable ownership area.

---

## 3. Scope and Non-Goals

### In scope for MVP

- Ubuntu Linux test endpoint.
- SSH authentication events and selected process events.
- HTTP batch ingestion.
- NATS JetStream for event delivery.
- ClickHouse for raw security events and PostgreSQL for application data.
- Four deterministic rules, one sequence rule, and one correlation scenario.
- Dashboard, event search, incident detail, and endpoint status screens.
- One attack simulation run only in an isolated local test environment.

### Explicitly out of scope for MVP

- Windows or macOS agents.
- eBPF, packet inspection, malware scanning, or automated remediation.
- Kubernetes, Terraform/OpenTofu, multi-region deployment, and 10,000+ events/second claims.
- A custom query language, visual rule builder, multi-tenancy, and full MITRE knowledge-base import.
- ML-generated detections or autonomous response actions.

Any feature outside this list is a post-MVP stretch goal and must not delay the complete demo.

---

## 4. Architecture

```text
Linux test endpoint
  -> Nolen Agent
  -> authenticated batch ingestion API
  -> NATS JetStream
  -> ClickHouse event store + Detection/Correlation service
  -> PostgreSQL incident/application store
  -> API / real-time updates
  -> Nolen SOC console

ClickHouse event store
  -> feature pipeline
  -> ML risk enrichment (shadow mode)
  -> incident detail UI
```

### Event contract: NEF

All components exchange **Nolen Event Format (NEF)** events. The MVP schema supports:

- `authentication`: SSH login success, failure, and invalid user.
- `process`: process name, PID, parent PID, command line, user, and privilege context where available.
- `file`: selected sensitive-file access events, if reliable collection is available.

Each event must have a stable ID, timestamp, host ID, category, action, result where applicable, source metadata, and schema version. The formal specification lives in `docs/specs/nef-v1.md`.

---

## 5. Team Ownership

One person is accountable for each primary area. Others may contribute through reviewed pull requests, but the owner makes the technical decisions, tests the work, and documents it.

| Owner | Role | Accountable deliverables |
|---|---|---|
| Eugene | Data Engineering & ML Lead | Event-data platform, storage schemas, data quality, feature pipeline, ML enrichment, data benchmarks |
| Timothy | Cybersecurity & Detection Lead | Threat model, detection/correlation logic, ATT&CK mapping, attack simulations, security validation |
| Dillon | Product UX/UI Lead | Analyst workflows, prototypes, design system, usability/accessibility, UI implementation or review |
| Nolan | Software & Integration Lead | Agent, ingestion API, application API, authentication, real-time integration, Compose/CI, end-to-end flow |

### 5.1 Eugene — Data Engineering & ML Lead

Eugene owns:

- NEF schema implementation, JSON validation, compatibility/versioning, and event-ID strategy.
- NATS stream definitions, durable-consumer behaviour, duplicate handling, and failed-event handling.
- ClickHouse schema, partitioning, retention policy, event-search queries, and query-performance measurements.
- PostgreSQL data model input for incidents, agents, rules, and status changes, in coordination with Nolan.
- Data-quality checks for malformed, duplicate, late, and missing event fields.
- Reproducible feature-table generation from stored telemetry.
- ML risk-enrichment experiment, evaluation report, and model explanation fields.
- Data platform documentation and benchmark methodology.

Eugene does **not** decide what behaviour is malicious; Timothy owns that security judgement.

### 5.2 Timothy — Cybersecurity & Detection Lead

Timothy owns:

- `docs/threat-model/THREAT_MODEL.md`, including forged telemetry, replay, event flooding, compromised agents, data exposure, and console compromise.
- Telemetry requirements: the security meaning and required fields for SSH, process, and file events.
- Detection-rule specification and rule content.
- MITRE ATT&CK mappings and analyst-facing detection explanations.
- Correlation logic and deterministic incident-confidence rules.
- An isolated, reproducible attack-simulation lab and safe simulation scripts.
- Detection tests, false-positive review, and security test cases for agent and API behaviour.
- Security review of agent authentication, authorization boundaries, rate limits, and sensitive telemetry handling.

Initial rules:

1. SSH brute force: ten failed logins from the same source IP within 60 seconds.
2. Repeated invalid SSH user attempts.
3. Privileged shell spawned.
4. Sensitive authentication-file access.
5. Sequence rule: successful login after a brute-force detection from the same source and host.

Initial correlation:

> **Probable SSH Account Compromise** = brute-force detection, successful login, and privileged shell activity on the same host/user within five minutes.

### 5.3 Dillon — Product UX/UI Lead

Dillon owns:

- Security analyst persona, assumptions, and critical investigation journey.
- Information architecture for Dashboard, Event Explorer, Incident Detail, and Endpoint Status.
- Low- and high-fidelity prototypes before full UI implementation.
- A reusable visual design system: colours, typography, spacing, status/severity treatment, empty/error/loading states, and components.
- Interaction specifications for filtering events, inspecting raw NEF evidence, changing incident status, and following an incident timeline.
- Accessibility review: keyboard navigation, contrast, labels, focus states, and non-colour severity cues.
- At least two usability tests or structured design reviews and a short record of changes made.

Dillon may implement the frontend components. If Nolan implements some screens, Dillon remains the design approver and provides component specifications and acceptance criteria.

### 5.4 Nolan — Software & Integration Lead

Nolan owns:

- Linux Nolen Agent for the agreed telemetry sources.
- Agent identity, enrollment, secure configuration handling, local event buffering, retry/backoff, and batched HTTP transport.
- Ingestion API: agent authentication, batch and request limits, NEF validation integration, rate limits, and stream publication.
- Application API: incidents, events, agents, rules, and incident-status updates.
- Authentication/authorization for the console, with Timothy reviewing the security design.
- Real-time critical-incident delivery through SSE or WebSockets.
- Docker Compose, CI checks, service health checks, and the end-to-end demo command.
- Integration tests across agent, API, data platform, detection service, and console.

Nolan does not own database design decisions, detection semantics, or UX decisions; those are reviewed by Eugene, Timothy, and Dillon respectively.

---

## 6. Shared Contracts and Decision Process

### NEF contract

- Eugene is accountable for the schema implementation and data guarantees.
- Timothy approves security semantics and required evidence fields.
- Nolan implements agent and ingestion compliance.
- Dillon specifies how raw evidence is understandable in the interface.

### API and incident contract

- Timothy owns incident meaning and required evidence.
- Eugene owns event and analytical data shape.
- Nolan owns API implementation and access control.
- Dillon owns the analyst-facing presentation and flow.

### Decisions

Major technical choices must be recorded as short Architecture Decision Records in `docs/adr/`. The accountable owner writes the decision; affected owners review it before implementation.

---

## 7. ML Risk Enrichment

ML is an enrichment layer, not the source of truth for an incident. Deterministic rules and correlation remain required even if the ML component is unavailable.

### Objective

Produce an explainable risk score for an authentication session or entity group (`source.ip`, `user.name`, `host.id`) that helps an analyst prioritize an already evidence-backed incident.

### Candidate features

- Failed-login counts over 1-, 5-, and 30-minute windows.
- Distinct usernames attempted by a source IP.
- New source IP for a user or host.
- Success-after-failure ratio.
- Login time relative to the user/host baseline.
- Privileged process activity after successful authentication.
- Sensitive-file access shortly after a login.

### Method and evaluation

- Build a reproducible dataset from normal test activity and the isolated simulations.
- Establish a non-ML baseline using deterministic rules and simple statistical thresholds.
- Train one interpretable model or anomaly detector, such as logistic regression or Isolation Forest.
- Use a time-based train/test split; do not randomly mix events from the same simulation into both sets.
- Report precision, recall, PR-AUC where labels allow it, and false alerts per host per day.
- Store the score, model version, and top contributing features with the enrichment result.
- Display the score as **“ML risk enrichment”** and never as proof that an attack occurred.

### Acceptance criteria

- A single command regenerates the feature dataset and evaluation report.
- The model is compared with the baseline on held-out time periods.
- The UI displays a score and at least one human-readable reason.
- Disabling the ML service does not stop deterministic detection or incident creation.

---

## 8. Product Requirements

### Agent and ingestion

- The agent collects SSH authentication events and basic process events from the designated Ubuntu test endpoint.
- The agent assigns stable event IDs, buffers unsent events locally, sends batches, and retries temporary failures.
- The ingestion API authenticates agents, rejects revoked identities, limits request/batch sizes, validates NEF, and publishes accepted events.
- The pipeline tolerates duplicate delivery using event IDs.

### Data platform

- Accepted events enter NATS and are persisted to ClickHouse by a durable consumer.
- Events can be filtered by time range, host, user, source IP, category, action, and result.
- Invalid events are rejected with clear errors or captured as failed events without crashing consumers.
- The team documents delivery semantics and duplicate-handling behaviour.

### Detection and incident correlation

- Detection rules are repository-managed YAML files.
- The engine supports equality matching, grouping, count windows, and the one required sequence rule.
- Each detection includes rule ID, severity, ATT&CK mapping, timestamp, and evidence event IDs.
- The correlation engine creates the required SSH-compromise incident deterministically.
- Each incident contains title, severity, confidence, status, entities, evidence IDs, timeline, and MITRE techniques.

### SOC console

- Dashboard: active incidents, critical incidents, monitored endpoints, and recent incidents.
- Event Explorer: structured filters and raw NEF inspection.
- Incident Detail: title, severity, status, confidence, ATT&CK mapping, affected entities, supporting evidence, and selectable timeline entries.
- Endpoint Status: hostname, agent version, last heartbeat, and online/offline status.
- New critical incidents appear without a manual page refresh under normal local conditions.

---

## 9. Milestones

### Milestone 0 — Contracts and UX direction

- NEF v1 draft agreed by Eugene and Timothy.
- Threat model first draft by Timothy.
- Architecture diagram and ADRs for transport, streams, and storage.
- Dillon’s critical analyst journey and initial prototype.
- Docker Compose skeleton and CI lint/test setup by Nolan.

### Milestone 1 — Events reach storage

- Agent emits authentication events.
- Authenticated ingestion accepts a batch.
- Events validate against NEF, enter NATS, and persist to ClickHouse.
- Event Explorer can display stored events.
- Duplicate and invalid event tests pass.

### Milestone 2 — Security story works

- Four rules, one sequence rule, and the SSH-compromise correlation exist.
- Isolated attack simulation produces a real incident without manually inserting database records.
- Incident detail displays raw evidence, timeline, and MITRE mapping.
- Critical incident reaches the dashboard in real time.

### Milestone 3 — Portfolio-quality finish

- ML enrichment runs in shadow mode and has a reproducible evaluation report.
- Usability/accessibility review is completed and improvements are implemented.
- Threat model, architecture, runbook, and benchmark methodology are published.
- End-to-end demo and tests run from a clean local environment.

---

## 10. Testing and Quality Gates

| Area | Required evidence |
|---|---|
| Data platform | NEF validation, duplicate delivery, consumer restart, query/filter, and data-quality tests |
| Cybersecurity | Rule tests, correlation tests, ATT&CK rationale, threat model, and simulation results |
| Agent/API | Buffer/retry, authentication, request limits, rate-limit, and integration tests |
| UX/UI | Critical-flow test, filter/evidence interaction tests, accessibility checklist, and design-review findings |
| ML | Reproducible dataset, baseline comparison, time-based evaluation, and explanation output |

No performance numbers may be claimed publicly unless the hardware, dataset, test command, and result are recorded. The MVP success target is a correct and reproducible end-to-end flow, not a high events-per-second number.

---

## 11. Demo Definition of Done

The command below, or an equivalent documented command, must run the whole story in an isolated local environment:

```bash
make demo-ssh-compromise
```

It must:

1. Start Nolen services and the test endpoint.
2. Generate repeated SSH failures, a successful authentication, and privileged shell activity.
3. Collect, validate, stream, and store the resulting events.
4. Produce the deterministic SSH-compromise incident.
5. Show the incident in the SOC console without manual database insertion.
6. Let an analyst inspect the timeline, raw NEF evidence, and ATT&CK mapping.
7. Show ML risk enrichment if the enrichment service is enabled.

---

## 12. Portfolio Deliverables

Each member must publish a short contribution page or README section covering their subsystem architecture, design decisions, failure modes, tests, and measurable evidence.

- **Eugene:** architecture of the data flow, schema/data-quality choices, benchmark methodology, ML notebook/report, evaluation metrics, and explainability examples.
- **Timothy:** threat model, detection coverage matrix, ATT&CK mappings, attack simulations, and security-test findings.
- **Dillon:** design case study, prototypes, design system, usability findings, and accessibility improvements.
- **Nolan:** agent/API architecture, reliability approach, auth/integration tests, CI/Compose setup, and end-to-end demo flow.

The project is successful only when the complete system works and each person can independently explain a meaningful contribution to it.
