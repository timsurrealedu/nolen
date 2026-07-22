# Console security acceptance

**Owner:** Dillon + Nolan

**Security reviewer:** Timothy
**Gate:** Required before closing `SEC-007` or exposing the console outside isolated local development.

## Test environment

- Build the production console bundle; development-mode behavior is not evidence.
- Use two users: `analyst` and `admin`, plus an unauthenticated browser context.
- Seed events and incidents containing the hostile strings below through test fixtures, never by executing commands.
- Run browser tests against the console and API on their deployed origins with response headers preserved.
- Capture the command, commit, browser version, and test result in the security review.

## Required automated cases

| ID | Case | Pass condition |
|---|---|---|
| CONSOLE-AUTH-001 | Open every protected route without a session | Redirect to login or return `401`; no incident, event, agent, or rule data appears in HTML, script state, or network responses. |
| CONSOLE-AUTH-002 | Use an expired, malformed, revoked, or logged-out session | Access fails closed; logout invalidates the server-side session and browser credential. |
| CONSOLE-AUTHZ-001 | Request event, incident, agent, and rule objects directly as each role | Every API and real-time endpoint performs server-side authorization; changing an object ID cannot bypass it. |
| CONSOLE-AUTHZ-002 | Attempt incident-status mutation as unauthorized and authorized roles | Unauthorized requests return `403` without mutation; the permitted role succeeds and produces an audit record. |
| CONSOLE-XSS-001 | Render hostile values in hostname, username, source IP label, command line, file path, rule title, incident title, and raw NEF | Values render as text. No script executes, DOM event handler appears, or unsafe URL becomes navigable. |
| CONSOLE-XSS-002 | Change timeline selection, filters, search, sort, and live updates while hostile values are present | Every rendering path remains encoded, including tooltips, charts, tables, copied text, and error states. |
| CONSOLE-CSP-001 | Inspect production document headers | `Content-Security-Policy` denies plugins and framing, restricts scripts to nonces or hashes, avoids `unsafe-eval`, and limits connections to required origins. |
| CONSOLE-CSRF-001 | Submit every state-changing request without the approved CSRF proof and from a foreign origin | Request is rejected without state change. Bearer-token APIs must reject ambient cookie authentication or enforce the same origin policy. |
| CONSOLE-SESSION-001 | Inspect session cookies and browser storage | Session cookies are `Secure`, `HttpOnly`, and `SameSite=Lax` or stricter; tokens and raw telemetry are absent from `localStorage` and `sessionStorage`. |
| CONSOLE-SSE-001 | Connect to incident SSE/WebSocket unauthenticated, then revoke an active session | Initial and continuing access require authorization; revocation closes or invalidates the stream without leaking later incidents. |
| CONSOLE-REDACT-001 | Display redacted and unredacted fixture variants | Secret values never appear in DOM, page source, client logs, error reports, analytics, or copied evidence. Redaction markers remain visible. |
| CONSOLE-HEADERS-001 | Inspect production responses | HTTPS deployment enables HSTS; responses set `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy`, and an explicit `frame-ancestors` policy. |
| CONSOLE-CACHE-001 | Navigate away, log out, and use browser back/forward cache | Protected evidence is not restored after logout; sensitive API responses are not stored in shared caches. |
| CONSOLE-ERROR-001 | Trigger `400`, `401`, `403`, `404`, `409`, `422`, and `500` paths | User-visible errors and logs contain no tokens, credentials, stack traces, raw sensitive command lines, or unauthorized object existence details. |

## Hostile fixture strings

Use these as inert data across every event-derived field:

```text
<script>globalThis.__nolenXss = true</script>
<img src=x onerror="globalThis.__nolenXss = true">
javascript:globalThis.__nolenXss=true
</textarea><svg onload="globalThis.__nolenXss = true">
Bearer console-test-secret
curl --password console-test-password https://example.invalid
```

The browser test must initialize `globalThis.__nolenXss = false`, exercise all views and interactions, and assert it remains `false`. Network and console logs must not contain `console-test-secret` or `console-test-password`.

## Manual review

- Confirm no use of raw HTML rendering for event-derived content unless a reviewed sanitizer and restrictive allowlist are applied.
- Confirm frontend authorization controls are convenience only; API checks remain authoritative.
- Review CSP violation reports and dependency audit output. A clean audit alone does not close this gate.
- Verify production source maps and error telemetry do not expose secrets or complete sensitive events.
- Verify security controls do not break keyboard navigation, focus visibility, labels, or non-color severity cues.

## Closure evidence

`SEC-007` closes only when the repository contains passing browser tests for every automated case, production header evidence, the manual-review record, and links to fixed findings. Skipped tests and development-server results do not count.

Closure evidence is recorded in `docs/security/SEC007_RESULTS.md`.
