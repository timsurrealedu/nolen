# External data v1

## LogHub OpenSSH

`data/raw/loghub-openssh/OpenSSH_2k.log` is an external, unlabelled SSH log corpus. It is converted only from terminal `Failed` and `Accepted` authentication messages; precursor lines such as `Invalid user` are ignored to avoid counting an attempt twice. Failed attempts explicitly marked `invalid user` become NEF `authentication/invalid_user`; other failures become `authentication/login`.

Run the conversion with a supplied year because the source omits one:

```powershell
$env:LOGHUB_START_YEAR = '2017'
npm.cmd run import:loghub-openssh
```

Outputs go to `data/processed/loghub-openssh/` and are intentionally ignored by Git. The import report profiles five-minute canonical entity windows. It is not a supervised training set: no source-ground-truth labels are available, and its attack-heavy distribution must not be called representative normal traffic.

Replay the converted events through the existing deterministic engine without publishing them or training ML:

```powershell
npm.cmd run replay:loghub-openssh
```

The resulting `replay-report.json` contains aggregate rule and incident counts plus bounded evidence-ID samples. It is a parser/rule-coverage check, not an accuracy claim.

## UNSW-NB15

The downloaded UNSW CSV files are network-flow data. Their labels and columns do not map safely to Nolen's SSH NEF features, so they are excluded from the current model. Keep them for a future, separately designed network-flow pipeline; do not merge them into SSH-window training data.
