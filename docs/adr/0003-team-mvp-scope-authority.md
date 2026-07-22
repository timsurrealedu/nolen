# ADR 0003: Team MVP scope authority

## Status

Accepted.

## Decision

`specifiedPRD.md` version 2.0 is authoritative for Team MVP scope and acceptance. `PRD.md` version 1.0 remains the broader product direction and post-MVP backlog.

Where they conflict, the Team MVP requires four detection behaviors, one sequence rule, and one SSH-compromise correlation scenario. The implementation uses five atomic YAML rules because SSH brute force has separate known-user and unknown-user variants. The broader targets of ten behaviors and three correlation scenarios begin only after the focused end-to-end demo is reproducible.

Security, validation, accessibility, and reliability requirements are not waived by this scope reduction. Requirements from `PRD.md` that support the focused flow still apply unless `specifiedPRD.md` explicitly excludes them.

## Consequences

- Team MVP completion is measured against one complete SSH-compromise investigation path.
- Additional detections and correlations remain planned work, not deleted requirements.
- New scope cannot delay the focused demo without an explicit PRD revision.
