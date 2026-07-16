# Safe SSH-compromise simulation fixture

`fixture.js` produces offline NEF-like events. It does not invoke SSH, execute a shell, modify files, or make network requests. Integration owners may feed it through the agent/ingestion pipeline to demonstrate the same detection story.

Run the local detector only:

```bash
node simulations/ssh-compromise/run.js
```

Run the complete offline scenario matrix with `node simulations/run.js`.
