# Nolen ML feature table v1

This table is derived from validated, redacted NEF events in ClickHouse. It is not a replacement for the deterministic detection engine. The initial offline build reads the synthetic JSONL/CSV pair and produces the same table shape.

## Grain

One row per five-minute window and entity:

```text
window_start + host.id + source.ip + user.name (nullable)
```

`user.name` remains null when it was not present in source telemetry. It is never converted to an empty string.

Events without both `host.id` and `source.ip` are excluded from this first entity feature table because they cannot be assigned to either canonical entity. The synthetic generator preserves source IP for post-login process and file telemetry so that those events remain attributable.

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

## Generate locally

```bash
npm run generate:dataset
npm run build:feature-table
```

This writes `simulations/ml/out/feature-table.csv`. The split is deterministic: the first 70% of observed UTC dates plus non-held-out scenarios are training data; rows from later dates or the held-out `invalid_user_enumeration` and `ssh_compromise` scenarios are test data. The scenario/time combination is therefore never present in both partitions.

## Baselines

```bash
npm run evaluate:baseline
```

This fits a small logistic-regression model from numeric feature columns using only rows with `split=train`. It writes an ignored model artifact and an evaluation report to `simulations/ml/out/`. The report separately evaluates the deterministic brute-force rule (`failed_login_count >= 10`) on exactly the same protected test rows. The deterministic engine remains the authoritative incident source; the ML result is an offline comparison and future enrichment signal only.
