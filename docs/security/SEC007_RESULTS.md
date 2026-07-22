# SEC-007 console security results

**Executed:** 2026-07-22  
**Environment:** production asset build, Playwright 1.60.0, Firefox 150.0.2, isolated local API fixtures and live Compose services

## Automated evidence

```bash
npm test
npm run test:console-security
npm run build:console
npm run verify:live-console
```

`apps/console/test/security.test.js` verifies protected routes, expired/revoked sessions, role authorization, CSRF, status audit behavior, CSP, secure cookies, HSTS/security headers, no-store caching, redaction, generic errors, and SSE revocation. `apps/console/test/sec007_browser.py` exercises hostile incident/event/endpoint values through dashboard, detail, filtering, navigation, analyst denial, admin mutation, logout, storage inspection, and back navigation in the production bundle. `globalThis.__nolenXss` remained `false`; no hostile element was created.

The live stack test displayed the persisted “Probable SSH Account Compromise” incident and all 12 evidence entries after a detection-service restart.

## Manual review

- Event-derived values use DOM `textContent`/text nodes; no raw-HTML rendering API exists in the bundle.
- API/session authorization is server-side. UI role checks only decide whether to display the admin control.
- CSP uses a per-response script nonce, blocks plugins/framing/base injection, and limits connections to the same origin.
- No client storage, analytics, error telemetry, or production source maps are used.
- Keyboard focus, semantic controls, skip navigation, labels, reduced motion, non-color severity text, long-value wrapping, and responsive layouts were reviewed against the current Web Interface Guidelines.
- Production errors contain stable codes only. Logs do not contain authorization headers, session IDs, raw command lines, or credential values.

All SEC-007 automated cases pass. HTTPS termination must preserve the documented HSTS and CSP headers in deployment.
