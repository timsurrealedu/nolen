# Offline security scenario matrix

Run all Timothy-owned security scenarios:

```bash
node simulations/run.js
```

The runner validates every event against NEF, executes deterministic detection and correlation, compares actual results with explicit expectations, and exits non-zero on a mismatch. It only constructs in-memory fixtures: no SSH connection, shell command, file mutation, or network request occurs.

| Scenario | Expected detections | Expected incidents |
|---|---|---|
| Normal operations | none | 0 |
| SSH compromise failures only | known-user brute force | 0 |
| Unknown-user brute force | unknown-user brute force | 0 |
| Invalid-user enumeration | invalid-user enumeration | 0 |
| Authorized maintenance | privileged shell, sensitive-file modification | 0 |
| SSH compromise | brute force, success sequence, privileged shell | 1 |

The authorized-maintenance scenario intentionally shows that individual high-signal detections may require analyst context; deterministic correlation prevents them from becoming an SSH-compromise incident without the complete attack sequence.
