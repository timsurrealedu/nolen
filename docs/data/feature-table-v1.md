# Nolen ML feature table v1

This table is derived from validated, redacted NEF events in ClickHouse. It is not a replacement for the deterministic detection engine.

## Grain

One row per five-minute window and entity:

```text
window_start + host.id + source.ip + user.name (nullable)
```

`user.name` remains null when it was not present in source telemetry. It is never converted to an empty string.

## Initial fields

| Field | Description |
|---|---|
| `window_start` | UTC start of the five-minute window |
| `host_id`, `source_ip`, `user_name` | Entity key |
| `failed_login_count` | SSH failures in the window |
| `invalid_user_count` | Invalid SSH-user attempts in the window |
| `successful_login_count` | SSH login successes in the window |
| `distinct_user_count` | Distinct non-null usernames attempted by the source IP/host |
| `elevated_shell_count` | Elevated bash/sh/zsh starts in the window |
| `sensitive_file_access_count` | Access to shadow, sudoers, or authorized keys |
| `cron_modify_count` | Cron modification events |
| `label` | External ground-truth label for offline training only |
| `is_malicious` | Derived from the labelling policy for offline training only |

## Dataset rules

- Build labels by joining `simulations/labels.csv` outside the production event contract.
- Keep model features, labels, scenario identifier, and split assignment in a reproducible generated dataset.
- Use scenario-and-time-separated train/test sets.
- Report a deterministic rules baseline before evaluating any ML model.
