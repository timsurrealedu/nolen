# ML baseline v1

## Purpose

This is an offline, reproducible comparison between Nolen's deterministic brute-force rule and a logistic-regression classifier. It is not a production decision-maker and cannot create, close, or suppress a security incident.

## Inputs and isolation

The workflow starts from redacted NEF events and external ground-truth labels:

```bash
npm run generate:dataset
npm run build:feature-table
npm run evaluate:baseline
```

Only numeric feature columns from training rows are used to fit the model. Scenario identifiers, raw IDs, IP addresses, usernames, labels, and split assignments are excluded from training. The generated feature table separates training and test data by both time and scenario; individual events are never randomly split.

## Features

The initial model uses event volume, failed and successful login counts, invalid-user attempts, distinct usernames, elevated-shell starts, sensitive-file access, and cron modifications. The generated report records standardized logistic-regression weights so an evaluator can inspect which features influenced the score.

## Evaluation

`simulations/ml/out/baseline-report.json` records the class distribution, confusion matrix, precision, recall, F1, accuracy, average precision, threshold-by-threshold precision/recall, and feature weights for both baselines on the exact same held-out rows. `simulations/ml/out/logistic-regression-model.json` contains the trained coefficients and scaling statistics.

These files are ignored by Git because they are generated artifacts. Record the dataset metadata and report together when presenting an experiment.

## Advisory shadow enrichment

```bash
npm run evaluate:shadow-enrichment
```

`simulations/ml/out/shadow-enrichment-report.json` is an offline, generated explanation artifact. For each canonical five-minute entity window it records a probability, low/medium/high risk band, three largest feature contributions, model version, and data-quality status. It contains no incident identifier or mutable incident field.

It is deliberately advisory-only: it cannot create, suppress, close, reprioritize, or otherwise modify deterministic incidents. Any future API or console presentation must preserve that boundary and require a separate team integration review.

## Challenge evaluation

```bash
npm run evaluate:challenge
```

This evaluation trains only on the standard dataset's training partition, then tests seven entirely separate challenge scenarios: benign retries near the threshold; low-volume and slow brute force; low-and-slow compromise; success after threshold without privilege escalation; success from a changed source; and a complete compromise variation. Each scenario declares its expected deterministic rule IDs and incident count. These rows are held-out evaluation data and must never be added to training. Results belong in `simulations/ml/out/challenge-report.json` and must be reported separately from the standard holdout score.

## Current limit

The current evaluation is synthetic. Strong metrics here demonstrate that the pipeline is reproducible and handles the defined scenarios; they do **not** demonstrate real-world detection performance. Before a production-like evaluation, Timothy must confirm representative telemetry fields, safe scenario/label provenance, and which detections remain deterministic-only.
