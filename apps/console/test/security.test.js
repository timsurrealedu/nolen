import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createConsoleServer } from '../src/server.js';

const hostile = '<img src=x onerror="globalThis.__nolenXss = true">';
const incident = { id: 'incident-1', title: hostile, severity: 'high', status: 'open', confidence: 80, createdAt: '2026-07-22T00:00:00.000Z', entities: { hostId: hostile, user: 'deploy' }, evidenceEventIds: ['event-1'], mitre: ['T1110'] };
const event = { id: 'event-1', timestamp: incident.createdAt, host: { id: hostile }, event: { category: 'process', action: 'start' }, process: { command_line: 'curl --password [REDACTED]' } };

async function fixture(options = {}) {
  const updates = [];
  const server = createConsoleServer({
    users: { analyst: { password: 'analyst-password', role: 'analyst' }, admin: { password: 'admin-password', role: 'admin' }, revoked: { password: 'revoked-password', role: 'analyst', revoked: true } },
    incidentRepository: { list: async () => [incident], updateStatus: async (id, status, user) => { updates.push({ id, status, user }); return { ...incident, status }; } },
    eventRepository: { search: async () => [event] }, agents: [{ hostname: hostile, status: 'online' }], secure: false, ...options
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, updates, close: () => new Promise(resolve => server.close(resolve)) };
}

async function login(origin, username = 'analyst', password = `${username}-password`) {
  const response = await fetch(`${origin}/session`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }) });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  const session = await fetch(`${origin}/api/session`, { headers: { cookie } });
  return { response, cookie, session: session.ok ? await session.json() : null };
}

test('CONSOLE-AUTH-001/002 protected routes and revoked credentials fail closed', async () => {
  const app = await fixture();
  for (const path of ['/', '/events', '/endpoints', '/incidents/incident-1']) {
    const response = await fetch(`${app.origin}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/login');
    assert.ok(!(await response.text()).includes(hostile));
  }
  for (const path of ['/api/incidents', '/api/events', '/api/agents', '/api/rules', '/api/stream/incidents']) assert.equal((await fetch(`${app.origin}${path}`)).status, 401);
  assert.equal((await login(app.origin, 'revoked')).response.headers.get('location'), '/login?failed=1');
  await app.close();
});

test('CONSOLE-AUTH-002 expired and malformed sessions fail closed', async () => {
  let clock = 1_000;
  const app = await fixture({ now: () => clock, sessionTtlMs: 10 }), identity = await login(app.origin);
  clock += 11;
  assert.equal((await fetch(`${app.origin}/api/incidents`, { headers: { cookie: identity.cookie } })).status, 401);
  assert.equal((await fetch(`${app.origin}/api/incidents`, { headers: { cookie: 'nolen_session=malformed' } })).status, 401);
  await app.close();
});

test('CONSOLE-AUTHZ/CSRF status changes require admin role, same origin, and CSRF proof', async () => {
  const app = await fixture(), analyst = await login(app.origin), admin = await login(app.origin, 'admin');
  const update = (identity, headers = {}) => fetch(`${app.origin}/api/incidents/incident-1/status`, { method: 'POST', headers: { cookie: identity.cookie, origin: app.origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ status: 'investigating' }) });
  assert.equal((await update(analyst, { 'x-csrf-token': analyst.session.csrf })).status, 403);
  assert.equal((await update(admin)).status, 403);
  assert.equal((await update(admin, { origin: 'https://foreign.invalid', 'x-csrf-token': admin.session.csrf })).status, 403);
  assert.equal((await update(admin, { 'x-csrf-token': admin.session.csrf })).status, 200);
  assert.deepEqual(app.updates, [{ id: 'incident-1', status: 'investigating', user: 'admin' }]);
  await app.close();
});

test('CONSOLE-CSP/SESSION/HEADERS/CACHE production responses carry browser controls', async () => {
  const app = await fixture({ secure: true }), identity = await login(app.origin);
  assert.match(identity.response.headers.get('set-cookie'), /HttpOnly/); assert.match(identity.response.headers.get('set-cookie'), /SameSite=Strict/); assert.match(identity.response.headers.get('set-cookie'), /Secure/);
  const response = await fetch(`${app.origin}/`, { headers: { cookie: identity.cookie } });
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /script-src 'nonce-/); assert.match(csp, /object-src 'none'/); assert.match(csp, /frame-ancestors 'none'/); assert.ok(!csp.includes('unsafe-eval'));
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); assert.match(response.headers.get('cache-control'), /no-store/);
  await app.close();
});

test('CONSOLE-XSS/REDACT hostile telemetry stays out of HTML execution paths and secrets stay redacted', async () => {
  const app = await fixture(), identity = await login(app.origin);
  const html = await (await fetch(`${app.origin}/`, { headers: { cookie: identity.cookie } })).text();
  assert.ok(!html.includes(hostile)); assert.ok(!html.includes('console-test-secret')); assert.ok(!html.includes('console-test-password'));
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.write/.test(script));
  const events = await (await fetch(`${app.origin}/api/events`, { headers: { cookie: identity.cookie } })).json();
  assert.equal(events.events[0].process.command_line, 'curl --password [REDACTED]');
  await app.close();
});

test('CONSOLE-SSE sessions are required and revocation closes active delivery', async () => {
  const app = await fixture();
  assert.equal((await fetch(`${app.origin}/api/stream/incidents`)).status, 401);
  const identity = await login(app.origin);
  const response = await fetch(`${app.origin}/api/stream/incidents`, { headers: { cookie: identity.cookie } });
  assert.equal(response.status, 200);
  app.server.revokeUser('analyst');
  assert.equal((await response.body.getReader().read()).done, true);
  assert.equal((await fetch(`${app.origin}/api/incidents`, { headers: { cookie: identity.cookie } })).status, 401);
  await app.close();
});

test('CONSOLE-ERROR errors expose no stack, credentials, or unauthorized object details', async () => {
  const app = await fixture({ incidentRepository: { list: async () => { throw new Error('Bearer console-test-secret'); } } }), identity = await login(app.origin);
  const response = await fetch(`${app.origin}/api/incidents`, { headers: { cookie: identity.cookie } }), text = await response.text();
  assert.equal(response.status, 500); assert.equal(text, '{"error":"request_failed"}'); assert.ok(!text.includes('console-test-secret'));
  await app.close();
});

test('CONSOLE-ERROR covers stable 400, 404, 409, and 422 mutation responses', async () => {
  const app = await fixture({ incidentRepository: { list: async () => [incident], updateStatus: async (id, status) => id === 'missing' ? undefined : { ...incident, status, previousStatus: status } } }), admin = await login(app.origin, 'admin');
  const send = (id, value) => fetch(`${app.origin}/api/incidents/${id}/status`, { method: 'POST', headers: { cookie: admin.cookie, origin: app.origin, 'x-csrf-token': admin.session.csrf, 'content-type': 'application/json' }, body: value });
  assert.equal((await send('incident-1', '{')).status, 400);
  assert.equal((await send('missing', JSON.stringify({ status: 'resolved' }))).status, 404);
  assert.equal((await send('incident-1', JSON.stringify({ status: 'open' }))).status, 409);
  assert.equal((await send('incident-1', JSON.stringify({ status: 'invalid' }))).status, 422);
  await app.close();
});
