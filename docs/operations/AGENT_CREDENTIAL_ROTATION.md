# Agent credential rotation

Agent credentials are versioned JSON files owned by the service account and mode `0600`:

```json
{"version":1,"agentId":"agent-01","token":"<random secret>","endpoint":"https://ingestion.example"}
```

## Provision

Write the file with `writeAgentCredential()` or an equivalent secret-management deployment step. Mount it outside the repository and set `NOLEN_AGENT_CREDENTIAL_FILE` for ingestion. The agent loads the same schema with `NolenAgent.fromCredentialFile()`.

## Rotate

1. Generate at least 32 random bytes with the deployment secret manager.
2. Stage the new owner-only credential on ingestion and the endpoint.
3. Stop endpoint delivery briefly; keep its local event buffer intact.
4. Atomically replace the ingestion credential and restart ingestion.
5. Call `rotateAgentCredential(path, newToken)` on the endpoint, then restart delivery.
6. Verify one harmless event is accepted with the new token and that the old token returns `401`.
7. Remove staged copies and record the agent ID, operator, and rotation time—never the token.

## Revoke

Remove or mark the server-side identity revoked immediately, restart/reload ingestion, and verify `401`. Preserve the endpoint buffer for investigation. Rotate any credential that may share the same secret and review events received since the suspected exposure.
