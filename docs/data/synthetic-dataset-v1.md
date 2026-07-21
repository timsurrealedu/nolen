# Synthetic dataset v1

The Nolen ML dataset generator produces deterministic, labelled, synthetic NEF data for reproducible offline experiments. It does not modify a host, invoke SSH, or open a network connection.

## Scenario mix

| Scenario | Security purpose | Event labels |
|---|---|---|
| Normal operations | Baseline user activity | `normal` |
| SSH brute force | Partial attack; no successful compromise | `brute_force` |
| Invalid-user enumeration | Account-enumeration precursor | `invalid_user_enumeration` |
| Authorized maintenance | Hard negative for high-signal activity | `authorized_maintenance` |
| SSH compromise | Full attack chain | `brute_force`, `successful_compromise`, `privileged_activity`, `sensitive_file_access` |

Labels remain in `labels.csv` and are joined only during offline feature generation. A five-minute entity window is malicious when it contains `brute_force`, `successful_compromise`, or `privileged_activity`; otherwise it is normal.

## Reproducibility

The default seed is `20260721`. Store the generated `metadata.json` beside every evaluation result. Split training and test data by both scenario and time; never randomly split individual events.
