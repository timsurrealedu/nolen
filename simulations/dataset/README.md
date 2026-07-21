# Synthetic ML dataset generator

Generate a deterministic, redacted-NEF dataset for offline ML experimentation:

```bash
npm run generate:dataset
```

The generated files are intentionally ignored by Git:

- `events.jsonl`: validated NEF events with no labels embedded in the event.
- `labels.csv`: external ground-truth labels keyed by event ID.
- `metadata.json`: seed and generation parameters for reproducibility.

The default generator covers normal operations, unsuccessful SSH brute force, invalid-user enumeration, authorized maintenance, and SSH compromise. It generates 24 hosts over thirty synthetic days using a fixed seed. This is synthetic evaluation data, not a claim about production attack prevalence.
