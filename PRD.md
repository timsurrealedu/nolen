
# NOLEN

## Product Requirements Document

**Document Version:** 1.0
**Project Type:** Open-Source Cybersecurity Platform
**Team Size:** 4 Engineers
**Target Platform:** Linux endpoints and web-based SOC console
**Primary Domain:** Security Operations, Endpoint Telemetry, Detection Engineering, Distributed Systems

> **Scope note:** This version 1.0 document describes the broader product target. `specifiedPRD.md` version 2.0 is authoritative for Team MVP scope and acceptance. Conflicting targets such as ten rules and three correlations are post-MVP work until the focused SSH-compromise demo is complete. See `docs/adr/0003-team-mvp-scope-authority.md`.

---

# 1. Product Overview

Nolen is a real-time security monitoring and incident detection platform designed to collect endpoint telemetry, analyze security events, detect suspicious behavior, and correlate related activity into understandable security incidents.

Traditional logging systems often present security teams with large volumes of isolated events.

For example:

* Multiple failed SSH login attempts
* A successful SSH login
* A privileged shell execution
* Access to a sensitive system file

Individually, these events may appear unrelated.

Nolen attempts to understand the relationship between these events and reconstruct the possible attack sequence.

Instead of presenting:

> 53 security events

Nolen should present:

> Probable SSH Account Compromise detected on `prod-web-01`.

The platform is designed as a simplified Security Information and Event Management and endpoint detection system for educational, research, and portfolio purposes.

Nolen is not intended to replace commercial SIEM, EDR, or XDR products.

---

# 2. Product Vision

Nolen's vision is to transform raw endpoint telemetry into understandable security incidents.

The platform should answer three primary questions:

1. What happened?
2. Why is it suspicious?
3. How are the security events related?

The final product should demonstrate real-world concepts from:

* Security Operations Centers
* Endpoint telemetry
* Detection engineering
* Event streaming
* Security event normalization
* Stateful event processing
* Incident correlation
* MITRE ATT&CK
* Distributed backend systems
* Security data visualization

---

# 3. Product Goals

## 3.1 Primary Goals

Nolen must be able to:

* Collect security telemetry from Linux endpoints.
* Securely transmit endpoint events to the Nolen platform.
* Normalize collected telemetry into a consistent event schema.
* Store and search large collections of security events.
* Evaluate events against security detection rules.
* Perform time-window and sequence-based detections.
* Correlate related security activity into incidents.
* Map detections to MITRE ATT&CK techniques.
* Provide a real-time Security Operations Center dashboard.
* Visualize attack timelines and relationships between security entities.
* Allow analysts to inspect the raw evidence supporting an incident.

---

## 3.2 Engineering Goals

The project should demonstrate:

* Clear subsystem boundaries.
* Independent engineering ownership.
* Schema-driven integration.
* Reliable event processing.
* Security-first architecture.
* Reproducible attack simulations.
* Automated tests.
* Technical documentation.
* Production-oriented engineering practices.

Each of the four engineers must own a technically substantial subsystem.

---

# 4. Non-Goals

The first version of Nolen will not attempt to:

* Replace commercial SIEM or EDR systems.
* Support every Linux distribution.
* Provide full malware detection.
* Perform antivirus scanning.
* Automatically remove malware.
* Support Windows endpoint telemetry.
* Support macOS endpoint telemetry.
* Perform packet-level deep packet inspection.
* Provide full digital forensics capabilities.
* Build a proprietary threat intelligence platform.
* Automatically execute destructive remediation.
* Guarantee detection of every security attack.
* Support multi-region production deployment.

These features may be considered in future versions.

---

# 5. Target Users

## 5.1 Primary User: Security Analyst

A security analyst monitors endpoints and investigates suspicious activity.

The analyst needs to:

* View active incidents.
* Understand why an incident was generated.
* Inspect related detections.
* Review attack timelines.
* Inspect raw events.
* Identify affected hosts and users.
* Review MITRE ATT&CK mappings.
* Change an incident's investigation status.

---

## 5.2 Secondary User: Detection Engineer

A detection engineer creates and maintains security detection rules.

The detection engineer needs to:

* Create detection rules.
* Define event conditions.
* Define grouping fields.
* Configure detection thresholds.
* Configure time windows.
* Build sequence detections.
* Test rules against simulated events.
* Map rules to MITRE ATT&CK.
* Enable or disable rules.

---

## 5.3 Secondary User: System Administrator

A system administrator deploys the Nolen Agent to monitored Linux systems.

The administrator needs to:

* Enroll endpoints.
* Install agents.
* Verify agent status.
* Review agent versions.
* Revoke compromised agents.
* Monitor endpoint connectivity.

---

# 6. Core Product Architecture

Nolen consists of four primary engineering domains.

```text
Linux Endpoint
      │
      ▼
Nolen Agent
      │
      │ Authenticated Batched Transport
      ▼
Ingestion Platform
      │
      ▼
Event Stream
      │
      ├──────────────────► Event Storage
      │
      ▼
Detection Engine
      │
      ▼
Correlation Engine
      │
      ▼
Incident Platform
      │
      ▼
Nolen SOC Console
```

The four primary subsystems are:

1. Endpoint Telemetry System
2. Detection and Correlation System
3. Event Data Platform
4. SOC Product and Investigation Interface

Each subsystem has a designated engineering owner.

---

# 7. Team Structure

## Engineer 1: Endpoint Systems Engineer

### Primary Mission

Build the endpoint telemetry collection system.

### Primary Ownership

* Nolen Agent
* Linux event collectors
* Local event buffering
* Agent enrollment
* Agent authentication
* Agent heartbeat
* Agent transport

### Owned Directories

```text
agent/
packages/agent-sdk/
docs/agent/
```

---

## Engineer 2: Detection and Security Engineer

### Primary Mission

Transform normalized security events into detections and incidents.

### Primary Ownership

* Nolen Event Format
* Detection rule specification
* Rule parser
* Detection engine
* Sequence detection
* Correlation engine
* MITRE ATT&CK mapping
* Security simulations

### Owned Directories

```text
services/detection-engine/
services/correlation-engine/
packages/nef/
packages/rule-parser/
rules/
simulations/
```

---

## Engineer 3: Data Platform Engineer

### Primary Mission

Reliably ingest, process, store, and deliver endpoint security telemetry.

### Primary Ownership

* Ingestion gateway
* Agent ingestion API
* Event streaming
* Event persistence
* Event search
* Real-time event delivery
* Data retention
* Performance testing

### Owned Directories

```text
apps/ingestion/
apps/api/
services/realtime/
infrastructure/data/
```

---

## Engineer 4: SOC Product Engineer

### Primary Mission

Build the analyst-facing investigation experience.

### Primary Ownership

* Web console
* SOC dashboard
* Incident pages
* Event explorer
* Endpoint pages
* Attack graph
* Investigation timeline
* Detection rule interface

### Owned Directories

```text
apps/console/
packages/ui/
```

---

# 8. Core Product Requirements

# 8.1 Nolen Agent

The Nolen Agent is a lightweight service installed on monitored Linux endpoints.

The first version must support Linux only.

## Functional Requirements

The agent must:

* Run as a background service.
* Generate or receive a unique agent identity.
* Enroll with the Nolen platform.
* Periodically send heartbeats.
* Collect supported Linux telemetry.
* Convert collected activity into Nolen Event Format events.
* Buffer events when the server is unavailable.
* Send events in batches.
* Retry failed transmission.
* Avoid executing collected programs or files.
* Report agent version information.

## Initial Telemetry Sources

The MVP must support:

### Authentication Events

* SSH login success
* SSH login failure
* Invalid SSH user
* Sudo activity

### Process Events

* Process start
* Process name
* Process ID
* Parent process ID
* Command line
* User context

### File Events

Limited sensitive file monitoring.

Initial monitored locations may include:

```text
/etc/passwd
/etc/shadow
/etc/sudoers
/etc/cron*
~/.ssh/authorized_keys
```

The project must document platform and permission limitations.

## Event Buffering

If Nolen is unavailable:

```text
Event 101
Event 102
Event 103
Event 104
```

Events must be stored locally.

When connectivity returns:

```text
Batch 1
101 → 104
```

The system should provide at-least-once event delivery where practical.

Duplicate events must be handled using event identifiers.

---

# 8.2 Nolen Event Format

Nolen must define a normalized security event schema.

The schema will be named:

> NEF — Nolen Event Format

All Nolen subsystems must use NEF as the standard event contract.

## Example

```json
{
  "nef_version": "1.0",
  "id": "evt_982fa",
  "timestamp": "2026-07-15T14:32:01Z",
  "event": {
    "category": "authentication",
    "action": "login",
    "result": "failure"
  },
  "host": {
    "id": "host_891",
    "name": "prod-api-01"
  },
  "user": {
    "name": "deploy"
  },
  "source": {
    "ip": "185.220.101.42"
  },
  "service": {
    "name": "ssh"
  }
}
```

## Initial Event Categories

NEF 1.0 should support:

```text
authentication
process
file
network
identity
system
```

Each category must have:

* Required fields.
* Optional fields.
* Field type definitions.
* Validation rules.
* Example events.

The specification must be documented in:

```text
docs/specs/nef-v1.md
```

---

# 8.3 Event Ingestion

The ingestion system receives batched events from Nolen Agents.

## Requirements

The ingestion gateway must:

* Authenticate agents.
* Accept batched events.
* Validate NEF events.
* Enforce maximum request limits.
* Generate clear validation errors.
* Apply basic rate limits.
* Reject revoked agents.
* Publish accepted events into the event stream.

## Event Flow

```text
Agent
  │
  ▼
Authentication
  │
  ▼
Batch Validation
  │
  ▼
NEF Validation
  │
  ▼
Event Stream
```

The ingestion platform should use HTTP or gRPC.

The final transport decision must be recorded in an Architecture Decision Record.

---

# 8.4 Event Streaming

Nolen should use an event streaming or durable messaging platform.

Recommended MVP technology:

> NATS JetStream

The system should define logical event streams.

Example:

```text
events.raw
events.normalized
detections
incidents
```

Required consumers include:

```text
Storage Consumer
Detection Consumer
Real-Time Consumer
```

The streaming system should support:

* Consumer acknowledgements.
* Retry behavior.
* Durable consumers.
* Basic backpressure handling.
* Dead-letter strategy or failed-event handling.

The delivery guarantees must be documented.

---

# 8.5 Event Storage

Nolen requires two primary forms of data storage.

## Event Database

Recommended:

> ClickHouse

Used for:

* Raw normalized events.
* Security event queries.
* Time-based event analysis.
* Aggregations.
* Event search.

## Application Database

Recommended:

> PostgreSQL

Used for:

* Users.
* Agents.
* Detection rules.
* Detections.
* Incidents.
* Incident status.
* MITRE mappings.
* Platform configuration.

## Requirements

Events must be searchable by:

* Time range.
* Host.
* Event category.
* Event action.
* Event result.
* Username.
* Source IP.
* Process name.

---

# 8.6 Detection Rule Engine

Nolen must support declarative detection rules.

Rules should be stored in a human-readable format.

Recommended format:

> YAML

## Example Rule

```yaml
id: NOLEN-SSH-001

name: SSH Brute Force

severity: high

match:
  event.category: authentication
  event.action: login
  event.result: failure
  service.name: ssh

group_by:
  - source.ip
  - user.name

condition:
  count: 10
  within: 60s

mitre:
  technique: T1110
```

## Detection Requirements

The detection engine must initially support:

### Field Matching

```text
equals
not equals
contains
starts with
in
```

### Count Detection

Example:

> Ten matching events within sixty seconds.

### Grouping

Example:

```text
source.ip
user.name
host.id
```

### Sliding Time Windows

Rules must support configurable time windows.

Example:

```text
10 events within 60 seconds
```

### Duplicate Suppression

The engine should prevent identical detections from being generated continuously.

Suppression rules must be documented.

---

# 8.7 Sequence Detection

Nolen should support multi-event sequence rules.

Example:

```yaml
id: NOLEN-PERSIST-002

name: Remote Payload Followed by Cron Modification

severity: critical

sequence:
  - match:
      event.category: process
      process.name:
        in:
          - curl
          - wget

  - match:
      event.category: file
      file.path:
        starts_with: /etc/cron

same:
  - host.id

within: 60s
```

The detection engine must:

* Store incomplete sequences.
* Track sequence progress.
* Enforce entity matching.
* Expire incomplete sequences.
* Generate detections for completed sequences.

Example internal state:

```text
Sequence ID: seq_1291

Rule:
NOLEN-PERSIST-002

Step 1:
COMPLETED

Step 2:
WAITING

Host:
host_21

Expires:
14:33:01
```

---

# 8.8 Correlation Engine

The correlation engine combines related security activity into incidents.

A detection represents suspicious behavior.

An incident represents a potential security attack.

Example:

```text
SSH Brute Force
      │
      ▼
Successful Authentication
      │
      ▼
Privileged Shell
      │
      ▼
Sensitive File Access
```

Nolen should generate:

> Probable SSH Account Compromise

## Example Correlation Rule

```yaml
id: NOLEN-CORR-001

name: Probable SSH Account Compromise

severity: critical

sequence:
  - detection: NOLEN-SSH-001

  - event:
      event.category: authentication
      event.action: login
      event.result: success

  - event:
      event.category: process
      process.privilege: elevated

same:
  - host.id
  - user.name

within: 5m
```

## Incident Requirements

An incident must contain:

* Unique incident ID.
* Title.
* Severity.
* Confidence score.
* Status.
* Created timestamp.
* Affected entities.
* Related detections.
* Evidence event IDs.
* Attack timeline.
* MITRE ATT&CK techniques.

---

# 8.9 Incident Confidence

Nolen may calculate an incident confidence score.

Example:

```text
94%
```

The MVP confidence score must be deterministic.

It must not rely on a language model.

Example factors:

```text
Base Correlation Match            +50
Multiple Detections               +10
Same Source IP                    +10
Same User                         +10
Same Host                         +10
Short Attack Time Window          +10
```

Maximum:

```text
100
```

The confidence calculation must be documented and explainable.

---

# 8.10 MITRE ATT&CK Mapping

Detection rules may contain MITRE ATT&CK technique mappings.

Example:

```yaml
mitre:
  tactic: credential-access
  technique: T1110
```

Nolen must display technique information on:

* Detection pages.
* Incident pages.
* Attack timelines.

The initial MVP should support a manually maintained subset of MITRE ATT&CK relevant to implemented rules.

Nolen does not need to import the complete MITRE ATT&CK knowledge base during the MVP.

---

# 8.11 SOC Dashboard

Nolen must provide a web-based analyst console.

## Required Dashboard Information

The main dashboard should display:

* Active incidents.
* Critical incidents.
* High severity incidents.
* Monitored endpoints.
* Online endpoints.
* Events per second.
* Event activity chart.
* Recent incidents.

Example:

```text
NOLEN                                      LIVE

SECURITY OVERVIEW

CRITICAL          HIGH          MEDIUM
    3              17              42

ACTIVE INCIDENTS                            7
MONITORED ENDPOINTS                       128
EVENTS / SECOND                         1,821

RECENT INCIDENTS

CRITICAL
Probable SSH Account Compromise
prod-web-01
2 minutes ago

HIGH
Suspicious Persistence Mechanism
employee-laptop-21
7 minutes ago
```

Real-time updates should be delivered through WebSockets or Server-Sent Events.

---

# 8.12 Incident Investigation Interface

The incident page is the primary Nolen product experience.

It must display:

* Incident title.
* Severity.
* Confidence.
* Status.
* Summary.
* Affected hosts.
* Affected users.
* Related source IP addresses.
* MITRE ATT&CK techniques.
* Attack timeline.
* Attack graph.
* Supporting evidence.

## Timeline Example

```text
14:32:01
│
● 47 SSH authentication failures
│
▼
14:32:05
│
● Successful SSH login
│
▼
14:32:07
│
● Elevated shell spawned
│
▼
14:32:18
│
● Sensitive file accessed
```

Every timeline event should be selectable.

Selecting an event must display its normalized NEF representation.

---

# 8.13 Attack Graph

Nolen should visualize relationships between incident entities.

Initial supported entity types:

```text
IP Address
User
Host
Process
File
```

Example:

```text
185.220.101.42
       │
       │ failed authentication
       ▼
     deploy
       │
       │ authenticated
       ▼
 prod-web-01
       │
       │ executed
       ▼
   /bin/bash
       │
       │ accessed
       ▼
 /etc/shadow
```

Initial supported relationships:

```text
authenticated
executed
spawned
accessed
modified
connected
```

Recommended visualization technology:

> React Flow

---

# 8.14 Event Explorer

Analysts must be able to search security events.

The MVP interface should provide structured filters.

Required filters:

* Time range.
* Event category.
* Host.
* Username.
* Source IP.
* Process name.
* Event result.

Example:

```text
Category
authentication

Result
failure

Source IP
185.220.101.42

Time
Last 1 hour
```

The application should display matching NEF events.

A custom query language is considered a future feature and is not required for the MVP.

---

# 8.15 Endpoint Management

The SOC console must provide an endpoint list.

Example:

```text
prod-api-01                 ONLINE

OS
Ubuntu 24.04

Agent
v0.2.1

Last Heartbeat
3 seconds ago

Events
182,391
```

Required endpoint information:

* Host ID.
* Hostname.
* Operating system.
* Agent version.
* Agent status.
* Last heartbeat.
* Total event count.

Endpoint statuses:

```text
ONLINE
DEGRADED
OFFLINE
REVOKED
```

The exact heartbeat thresholds must be documented.

---

# 8.16 Detection Rule Management

The application must provide a rule management interface.

Users must be able to:

* View rules.
* View rule details.
* Enable rules.
* Disable rules.
* View rule severity.
* View MITRE mappings.

A visual detection rule builder is considered a secondary requirement.

The MVP may initially use repository-managed YAML rules.

---

# 9. Initial Detection Rules

The MVP should include at least ten detection rules.

Recommended initial rules:

## Authentication

### NOLEN-SSH-001

SSH Brute Force

Detect repeated SSH authentication failures.

### NOLEN-SSH-002

Successful Authentication After Brute Force

Detect successful login from a previously detected brute-force source.

### NOLEN-AUTH-003

Repeated Invalid User Authentication

Detect repeated SSH login attempts against nonexistent users.

---

## Process

### NOLEN-PROC-001

Privileged Shell Spawned

Detect an elevated shell.

### NOLEN-PROC-002

Suspicious Download Utility Execution

Detect potentially suspicious use of curl or wget.

### NOLEN-PROC-003

Encoded Command Execution

Detect selected suspicious encoded command patterns where applicable.

---

## Persistence

### NOLEN-PERSIST-001

Cron Configuration Modification

Detect changes to monitored cron configuration.

### NOLEN-PERSIST-002

Remote Download Followed by Cron Modification

Sequence detection.

---

## Identity and Sensitive Files

### NOLEN-FILE-001

Sensitive Authentication File Access

Detect suspicious access to selected sensitive files.

### NOLEN-IDENTITY-001

SSH Authorized Keys Modification

Detect modification of `authorized_keys`.

---

# 10. Initial Correlation Scenarios

Nolen should include at least three complete incident correlation scenarios.

## Scenario 1: SSH Account Compromise

```text
SSH Brute Force
      ↓
Successful Login
      ↓
Privileged Shell
      ↓
Sensitive File Access
```

Expected incident:

> Probable SSH Account Compromise

---

## Scenario 2: Suspicious Persistence Installation

```text
curl or wget execution
      ↓
Remote payload activity
      ↓
Cron modification
```

Expected incident:

> Suspicious Persistence Mechanism Installed

---

## Scenario 3: Unauthorized SSH Persistence

```text
Successful Authentication
      ↓
Shell Activity
      ↓
authorized_keys Modification
```

Expected incident:

> Possible SSH Persistence Established

---

# 11. Security Requirements

Because Nolen processes sensitive security telemetry, security must be treated as a core product requirement.

## Agent Security

* Agents must have unique identities.
* Revoked agents must not send events.
* Agent credentials must not be logged.
* Transport must be encrypted.
* Agent enrollment must be authenticated.

## Event Security

* Events may contain sensitive command-line data.
* Security events must not be publicly accessible.
* Logging systems should avoid unnecessarily duplicating sensitive telemetry.
* Event retention must be configurable in future versions.

## API Security

* Validate all input.
* Apply request size limits.
* Apply batch limits.
* Apply rate limits.
* Use structured authorization checks.
* Do not trust agent-provided host identity without validation.

## Web Security

The console should implement:

* Secure session management.
* CSRF protection where applicable.
* XSS protection.
* Strong Content Security Policy where practical.
* Authorization for protected resources.

## Threat Model

The repository must contain:

```text
docs/threat-model/THREAT_MODEL.md
```

The threat model must address:

* Malicious endpoints.
* Compromised agents.
* Forged telemetry.
* Event flooding.
* Replay attacks.
* Sensitive command-line telemetry.
* Dashboard compromise.
* Message-stream failure.
* Database exposure.

---

# 12. Reliability Requirements

Nolen must account for component failure.

## Agent Offline

Events must be buffered locally.

## Ingestion Failure

Agents must retry with backoff.

## Event Consumer Failure

Durable message consumers must resume processing.

## Duplicate Delivery

Consumers must tolerate duplicate events.

## Invalid Events

Invalid events must not crash the processing pipeline.

They should be rejected or routed to failed-event handling.

## Detection Engine Restart

The team must document what happens to active detection windows after restart.

The MVP may use Redis or another external state system for temporary detection state.

---

# 13. Performance Targets

These targets are engineering goals rather than production guarantees.

The team must document test hardware and methodology.

## MVP Targets

### Agent

Average memory usage target:

```text
< 100 MB
```

Idle CPU target:

```text
< 1%
```

### Ingestion

Target sustained local test throughput:

```text
10,000 events per second
```

Stretch target:

```text
50,000 events per second
```

### Dashboard

New critical incidents should appear in the console within:

```text
5 seconds
```

of incident creation during normal test conditions.

### Search

Common event searches over the test dataset should return within:

```text
2 seconds
```

where practical.

Performance claims must only be published with reproducible benchmarks.

---

# 14. Technology Stack

The recommended initial stack is:

## Agent

```text
Go
```

## Ingestion

```text
Go
gRPC or HTTP
```

## Event Streaming

```text
NATS JetStream
```

## Detection and Correlation

```text
Go
Redis
```

## Event Storage

```text
ClickHouse
```

## Application Storage

```text
PostgreSQL
```

## Frontend

```text
Next.js
TypeScript
```

## User Interface

```text
Tailwind CSS
shadcn/ui
React Flow
```

## Real-Time Updates

```text
WebSocket or Server-Sent Events
```

## Observability

```text
OpenTelemetry
Prometheus
Grafana
```

## Development Infrastructure

```text
Docker
Docker Compose
```

## Future Deployment

```text
Kubernetes
OpenTofu or Terraform
```

Technology choices may change.

Any major architectural change must be documented using an Architecture Decision Record.

---

# 15. Repository Structure

Recommended monorepo structure:

```text
nolen/
│
├── apps/
│   ├── console/
│   ├── api/
│   └── ingestion/
│
├── services/
│   ├── detection-engine/
│   ├── correlation-engine/
│   └── realtime/
│
├── agent/
│   └── nolen-agent/
│
├── packages/
│   ├── nef/
│   ├── rule-parser/
│   ├── agent-sdk/
│   └── ui/
│
├── rules/
│   ├── authentication/
│   ├── process/
│   ├── persistence/
│   └── correlation/
│
├── simulations/
│   ├── ssh-account-compromise/
│   ├── cron-persistence/
│   └── ssh-persistence/
│
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── opentofu/
│
├── docs/
│   ├── architecture/
│   ├── specs/
│   ├── threat-model/
│   └── adr/
│
├── .github/
│   └── workflows/
│
├── README.md
├── CONTRIBUTING.md
└── SECURITY.md
```

---

# 16. Cross-Team Engineering Contracts

The project must use defined contracts between subsystems.

These contracts must be agreed upon before major implementation work begins.

## Contract 1: NEF

Producer:

> Nolen Agent

Consumers:

> Ingestion Platform
> Detection Engine
> Event Storage
> SOC Console

The NEF specification is the primary event contract.

---

## Contract 2: Detection Model

Example:

```json
{
  "id": "det_29f",
  "rule_id": "NOLEN-SSH-001",
  "title": "SSH Brute Force",
  "severity": "high",
  "host_id": "host_21",
  "created_at": "2026-07-15T14:32:10Z",
  "evidence": [
    "evt_1",
    "evt_2",
    "evt_3"
  ]
}
```

Producer:

> Detection Engine

Consumers:

> Correlation Engine
> Application API
> SOC Console

---

## Contract 3: Incident Model

Example:

```json
{
  "id": "inc_291",
  "title": "Probable SSH Account Compromise",
  "severity": "critical",
  "confidence": 0.94,
  "status": "open",
  "entities": [
    {
      "type": "ip",
      "value": "185.220.101.42"
    },
    {
      "type": "user",
      "value": "deploy"
    }
  ],
  "timeline": [
    {
      "event_id": "evt_129",
      "timestamp": "2026-07-15T14:32:01Z",
      "summary": "47 SSH authentication failures"
    }
  ],
  "techniques": [
    "T1110",
    "T1078",
    "T1548"
  ]
}
```

Producer:

> Correlation Engine

Consumers:

> Application API
> SOC Console

---

# 17. Development Principles

## Contract First

Subsystem interfaces must be documented before implementation.

## Test With Realistic Events

Detection systems must be tested using reproducible security simulations.

## Explain Every Detection

Every detection must contain supporting evidence.

Nolen should never generate:

> Suspicious activity detected.

without explaining why.

## Evidence Before AI

The core Nolen platform must work without artificial intelligence.

Detection and correlation must remain deterministic.

## Security by Design

Sensitive security telemetry must be treated as sensitive data.

## Honest Benchmarks

The team must not publish performance claims without documenting the test environment.

## Clear Ownership

Every production subsystem must have one primary owner.

Collaboration is encouraged, but ownership must remain identifiable.

---

# 18. Testing Requirements

## Agent

Required tests:

* Event parsing tests.
* NEF conversion tests.
* Buffer persistence tests.
* Retry behavior tests.
* Batch creation tests.

## Data Platform

Required tests:

* Authentication tests.
* Batch validation tests.
* Invalid NEF rejection tests.
* Event persistence tests.
* Consumer retry tests.
* Duplicate event tests.

## Detection Engine

Required tests:

* Field matcher tests.
* Grouping tests.
* Count-window tests.
* Window expiration tests.
* Sequence tests.
* Detection suppression tests.

## Correlation Engine

Required tests:

* Sequence correlation.
* Entity matching.
* Incident generation.
* Confidence calculation.
* Duplicate incident suppression.

## Frontend

Required tests:

* Critical analyst flows.
* Incident loading.
* Event evidence display.
* Filter behavior.
* Real-time incident updates.

---

# 19. Demo Requirements

The final project demo must not depend on manually creating database records.

The team must provide automated simulations.

Example:

```bash
make demo-ssh-compromise
```

Expected flow:

```text
1. Start vulnerable test environment.

2. Start Nolen Agent.

3. Generate SSH authentication failures.

4. Generate successful authentication.

5. Generate privileged shell activity.

6. Access sensitive file.

7. Nolen Agent collects telemetry.

8. Events enter the ingestion pipeline.

9. Detection engine generates detections.

10. Correlation engine creates an incident.

11. Critical incident appears in the Nolen console.

12. Analyst opens the incident.

13. Attack timeline and graph display supporting evidence.
```

The full scenario should demonstrate the complete Nolen architecture.

---

# 20. MVP Definition

Nolen MVP is complete when:

* One Linux endpoint can run Nolen Agent.
* Agent enrollment works.
* Authentication telemetry is collected.
* Process telemetry is collected.
* Events are converted to NEF.
* Events are delivered in batches.
* Temporary network failure does not immediately lose buffered events.
* The ingestion service validates events.
* Events enter the event stream.
* Events are persisted.
* Analysts can search events.
* At least ten detection rules exist.
* Count-window detection works.
* Sequence detection works.
* At least three incident correlation rules exist.
* Incidents contain evidence events.
* Incidents contain MITRE ATT&CK mappings.
* The dashboard displays active incidents.
* Critical incidents update in real time.
* The incident page displays an attack timeline.
* The incident page displays an attack graph.
* Three automated attack simulation scenarios exist.
* Core services contain automated tests.
* The architecture is documented.
* The threat model is documented.
* A complete end-to-end demo can be reproduced.

---

# 21. Future Features

Features outside the initial MVP may include:

* Windows Agent.
* macOS Agent.
* eBPF telemetry.
* CloudTrail ingestion.
* Kubernetes audit log ingestion.
* Detection rule visual editor.
* Custom Nolen query language.
* Sigma rule compatibility.
* Threat intelligence enrichment.
* IP reputation.
* GeoIP enrichment.
* Asset risk scoring.
* Automated containment.
* Agent remote configuration.
* Multi-tenancy.
* Detection-as-code CI.
* Historical rule replay.
* AI-assisted investigations.
* Natural-language event querying.
* Automated incident reports.

These features should only be started after the MVP architecture is stable.

---

# 22. Product Success Criteria

The project is successful when Nolen can demonstrate the following story:

> An attacker performs multiple SSH authentication attempts against a monitored Linux server.

> The Nolen Agent collects authentication telemetry and forwards normalized events to the platform.

> Nolen identifies the brute-force behavior.

> The attacker successfully authenticates.

> The compromised account executes an elevated shell and accesses sensitive system resources.

> Nolen correlates the separate security activities into a single probable account compromise incident.

> A security analyst receives the incident in real time and can inspect the complete attack timeline, affected entities, MITRE ATT&CK techniques, and raw supporting evidence.

The core product promise is:

> **Nolen turns endpoint activity into understandable security incidents.**

---

# 23. Final Team Objective

Nolen should not be presented as four disconnected student projects.

It must function as one complete engineering system.

```text
Endpoint Engineer
      │
      │ produces NEF
      ▼
Data Platform Engineer
      │
      │ delivers events
      ▼
Detection Engineer
      │
      │ creates security intelligence
      ▼
SOC Product Engineer
      │
      │ enables investigation
      ▼
Security Analyst
```

Every engineer owns a different part of the problem.

Every subsystem depends on shared technical contracts.

Every member should be capable of explaining:

* Their subsystem architecture.
* Their engineering decisions.
* Their failure modes.
* Their security considerations.
* Their testing strategy.
* How their subsystem integrates with the rest of Nolen.

Nolen is complete when the four independently owned engineering domains operate as a single real-time security monitoring and incident investigation platform.
