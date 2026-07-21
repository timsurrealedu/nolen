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

`simulations/ml/out/baseline-report.json` records the confusion matrix, precision, recall, F1, accuracy, and feature weights for both baselines on the exact same held-out rows. `simulations/ml/out/logistic-regression-model.json` contains the trained coefficients and scaling statistics.

These files are ignored by Git because they are generated artifacts. Record the dataset metadata and report together when presenting an experiment.

## Challenge evaluation

```bash
npm run evaluate:challenge
```

This evaluation trains only on the standard dataset's training partition, then tests two entirely separate challenge scenarios: benign retries close to the brute-force threshold and a low-and-slow compromise with fewer than ten failures. It is designed to expose pattern memorization and blind spots. Its result belongs in `simulations/ml/out/challenge-report.json` and must be reported separately from the standard holdout score.

## Current limit

The current evaluation is synthetic. Strong metrics here demonstrate that the pipeline is reproducible and handles the defined scenarios; they do **not** demonstrate real-world detection performance. Before a production-like evaluation, Timothy must confirm representative telemetry fields, safe scenario/label provenance, and which detections remain deterministic-only.
