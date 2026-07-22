# Detection and correlation design

Repository YAML under `rules/` is the authoritative detection-as-code source. The shared parser validates required metadata, thresholds, durations, grouping, sequences, and correlations during module startup; invalid rules stop the detection service before telemetry is processed.

## Coverage and ATT&CK rationale

| Rule | Behaviour | ATT&CK | Rationale |
|---|---|---|---|
| NOLEN-SSH-001 | 10 SSH failures/source/user/host in 60s | T1110 Brute Force | repeated remote authentication failures |
| NOLEN-SSH-002 | 5 invalid SSH usernames/source/host in 60s | Unmapped | account-enumeration precursor; not exploitation of a public-facing application |
| NOLEN-SSH-003 | 10 SSH failures without a username, grouped by source/host in 60s | T1110 Brute Force | password guessing where the collector cannot identify a valid account |
| NOLEN-PROC-001 | elevated interactive shell | T1059.004 Unix Shell | privileged command-shell execution |
| NOLEN-FILE-001 | selected security-file access or modification | T1003 OS Credential Dumping | access to credential-bearing files; persistence-oriented modifications require separate review before adding another mapping |
| NOLEN-SEQ-001 | successful SSH login after brute force | T1078 Valid Accounts | successful use after password guessing |

## Incident policy

`NOLEN-CORR-001` creates **Probable SSH Account Compromise** only when an explicit brute-force detection (`NOLEN-SSH-001` or `NOLEN-SSH-003`), its success-after-brute-force sequence, and a privileged-shell detection share the required source, host, and successful-login user within five minutes. It stores all three detection IDs, supporting event IDs, entities, ATT&CK techniques, and status `open`.

Confidence is deterministic: base correlation match 50, same host 10, same user 10, and five-minute window 10 = **80**. It is intentionally explainable and must not be replaced by ML enrichment.

## False-positive review

Thresholds are conservative MVP defaults. Exclude known load-test sources only through version-controlled allowlists with review; never silently suppress a rule. Every rule change requires fixture-based tests and a documented rationale.

Verified boundaries:

- Count rules keep hosts, sources, and known users in separate groups; duplicate event IDs do not increase counts.
- A qualifying count window remains detectable when later events fall outside it; events spanning more than the configured window do not combine.
- `/etc/passwd` and reads under `/etc/cron*` remain telemetry only. Selected credential-file access and `/etc/cron*` modification produce detections.
- Elevated non-shell processes do not trigger the privileged-shell rule.
- Correlation requires the successful login to match the brute-force source and host, followed by a privileged shell for the same host/user within five minutes.
