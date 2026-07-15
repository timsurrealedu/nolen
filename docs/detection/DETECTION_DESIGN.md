# Detection and correlation design

Rules in `rules/` are the reviewed detection-as-code source. The lightweight MVP engine mirrors their semantics until a shared rule parser is supplied.

## Coverage and ATT&CK rationale

| Rule | Behaviour | ATT&CK | Rationale |
|---|---|---|---|
| NOLEN-SSH-001 | 10 SSH failures/source/user/host in 60s | T1110 Brute Force | repeated remote authentication failures |
| NOLEN-SSH-002 | 5 invalid SSH usernames/source/host in 60s | T1190 Exploit Public-Facing Application | reconnaissance-style invalid-account probing; retained as an MVP heuristic |
| NOLEN-PROC-001 | elevated interactive shell | T1059.004 Unix Shell | privileged command-shell execution |
| NOLEN-FILE-001 | selected auth-file access | T1003 OS Credential Dumping | access to credential-bearing system files |
| NOLEN-SEQ-001 | successful SSH login after brute force | T1078 Valid Accounts | successful use after password guessing |

## Incident policy

`NOLEN-CORR-001` creates **Probable SSH Account Compromise** only when the sequence detection and privileged-shell detection share `host.id` and `user.name` within five minutes. It stores all supporting event IDs, relevant detection IDs, entities, ATT&CK techniques, and status `open`.

Confidence is deterministic: base correlation match 50, same host 10, same user 10, and five-minute window 10 = **80**. It is intentionally explainable and must not be replaced by ML enrichment.

## False-positive review

Thresholds are conservative MVP defaults. Exclude known load-test sources only through version-controlled allowlists with review; never silently suppress a rule. Every rule change requires fixture-based tests and a documented rationale.
