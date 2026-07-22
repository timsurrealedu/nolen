# ML data-quality and readiness checks

## Purpose

`npm run validate:ml-data` examines the generated event and external-label files before they are used for feature generation or ML experiments. It writes an inspectable report to `simulations/ml/out/data-quality-report.json`.

## Two layers of validation

1. **Telemetry quality:** Every event is checked against the NEF contract. The validator also checks event-ID uniqueness, timestamps after the report reference time, empty usernames, and event/label join integrity.
2. **ML readiness:** It verifies that an event can be placed into the canonical five-minute entity grain, builds the feature table only when critical checks pass, and profiles window counts, classes, splits, and features with no observed signal.

## Why these checks matter

| Check | Risk if it fails | Severity |
|---|---|---|
| Invalid NEF, duplicate event ID, or missing external label | Wrong event joins or untrustworthy supervised labels | Critical: blocks ML use |
| Orphan label, future timestamp, or empty username | Stale provenance, clock issues, or incorrect entity merges | High: investigate before use |
| Missing canonical entity fields or zero-only feature | An event cannot safely affect an ML window, or a feature cannot teach the model | Medium: record and improve telemetry |
| Minority class below 10% of windows | Accuracy can look strong while attack recall is poor | Medium: use class-aware evaluation and add representative scenarios |

The validator does not invent a username for missing telemetry and does not silently drop issues. A valid process/file event without `source.ip` is accepted as telemetry but reported as not ML-entity-ready; this is the field decision that needs Timothy's input.

## Run order

```bash
npm run generate:dataset
npm run validate:ml-data
npm run build:feature-table
npm run evaluate:baseline
```

For the normal workflow, use the guarded command instead:

```bash
npm run ml:pipeline
```

It regenerates the synthetic data, validates it, builds the feature table, and evaluates the baseline in that order. A `blocked` quality report ends the command with a non-zero exit code before a feature table or model evaluation can be produced. High and medium findings are kept in the report and permit experimentation, but must be addressed before making production claims.

Read `summary.status` first: `blocked` means fix critical integrity issues; `needs_attention` means investigate high-severity findings; `ready_with_warnings` means the dataset can be used for an experiment but has material limitations; `ready_for_offline_ml` means the current dataset passed the automated checks, not that it is proven representative of production traffic.
