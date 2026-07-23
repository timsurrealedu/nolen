# ML Shadow-Enrichment Demo

## Goal

Show that Nolen combines deterministic cybersecurity detections with explainable ML analysis without allowing ML to control incidents.

## Before presenting

From the repository root, run:

```powershell
npm.cmd run ml:pipeline
npm.cmd run evaluate:challenge
```

This creates these ignored, reproducible outputs:

- `simulations/ml/out/data-quality-report.json`
- `simulations/ml/out/baseline-report.json`
- `simulations/ml/out/shadow-enrichment-report.json`
- `simulations/ml/out/challenge-report.json`

## Three-minute walkthrough

### 1. Start with the security boundary

> Nolen creates incidents using Timothy's deterministic rules and correlation logic. My ML component is advisory-only: it cannot create, suppress, close, reprioritize, or modify an incident.

Point to `shadow-enrichment-report.json`. Each record says `advisory_only: true` and has no incident ID or status field.

### 2. Show the data-engineering pipeline

> I generate redacted NEF telemetry with external ground-truth labels, validate it, and convert it into five-minute windows. The canonical entity is source IP + username + host when a username exists, or source IP + host when it does not. Missing usernames are never turned into empty strings.

Show `data-quality-report.json`:

- The current data is `ready_with_warnings`.
- The warning is class imbalance: 51 malicious windows and 922 normal windows.
- This is why accuracy alone is not an acceptable result.

### 3. Show explainable ML advice

> The logistic-regression model scores each window and stores its probability, risk band, model version, quality status, and top three feature contributions. For a high-risk SSH window, failed-login count and total event count are the main positive contributors.

In `shadow-enrichment-report.json`, find a record with `risk_band: "high"`. Explain that this is an analyst-facing signal, not an automated verdict.

### 4. Give the honest evaluation result

> On the standard synthetic holdout, the model has strong scores. That only proves the pipeline is reproducible on its defined synthetic scenarios; it is not a production-performance claim.

> The separate low-and-slow challenge is more important: the deterministic brute-force baseline has F1 0, while the ML model has F1 about 0.276. It catches only some unseen attacks and also produces false positives. That demonstrates the current limit and why deterministic rules stay authoritative.

Show `challenge-report.json` and point out that the challenge data is never used for training.

## Closing statement

> My contribution is a reproducible data and ML pipeline with strict telemetry validation, external labels, time-and-scenario-safe evaluation splits, explainable shadow scoring, and explicit limits. The system remains safe because cybersecurity incidents remain deterministic and auditable.

## Do not claim

- That the synthetic holdout score represents real-world accuracy.
- That ML detects or confirms an incident on its own.
- That the low-and-slow challenge is solved.
- That the generated data represents production attack prevalence.
