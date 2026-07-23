import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const encode = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const cookie = request => Object.fromEntries((request.headers.cookie ?? '').split(';').flatMap(item => { const index = item.indexOf('='); return index < 0 ? [] : [[item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))]]; }));
const equal = (left, right) => { const a = Buffer.from(left ?? ''), b = Buffer.from(right ?? ''); return a.length === b.length && timingSafeEqual(a, b); };
const body = request => new Promise((resolve, reject) => { let value = ''; request.on('data', chunk => { value += chunk; if (value.length > 100_000) request.destroy(); }); request.on('end', () => resolve(value)); request.on('error', reject); });

export function createConsoleServer({ users = {}, incidentRepository, eventRepository, shadowEnrichmentRepository, agents = [], rules = [], secure = true, sessionTtlMs = 8 * 60 * 60_000, now = Date.now, assetDirectory = new URL('../public/', import.meta.url) } = {}) {
  const sessions = new Map(), streams = new Map();
  const session = request => {
    const id = cookie(request).nolen_session, value = sessions.get(id);
    if (!value || value.expiresAt <= now()) { if (id) sessions.delete(id); return; }
    return { id, ...value };
  };
  const securityHeaders = nonce => ({
    'cache-control': 'no-store, max-age=0',
    'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    ...(secure ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {})
  });
  const send = (response, status, value, headers = {}) => { response.writeHead(status, { ...securityHeaders(randomBytes(12).toString('base64')), ...headers }); response.end(value); };
  const json = (response, status, value) => send(response, status, JSON.stringify(value), { 'content-type': 'application/json; charset=utf-8' });
  const authorized = (request, response, roles = ['analyst', 'admin']) => {
    const current = session(request);
    if (!current) { json(response, 401, { error: 'authentication_required' }); return; }
    if (!roles.includes(current.role)) { json(response, 403, { error: 'forbidden' }); return; }
    return current;
  };
  const mutationAllowed = (request, response, current) => {
    const expectedOrigin = `${secure ? 'https' : 'http'}://${request.headers.host}`;
    if (request.headers.origin !== expectedOrigin || request.headers['x-csrf-token'] !== current.csrf) { json(response, 403, { error: 'csrf_rejected' }); return false; }
    return true;
  };
  const login = message => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Nolen</title><link rel="stylesheet" href="/assets/styles.css"></head><body class="login"><main><form method="post" action="/session" class="login-panel"><div class="mark" aria-hidden="true">N</div><h1>Analyst Sign In</h1><p>Use your assigned Nolen identity. Sessions stay on this device and expire automatically.</p>${message ? `<p class="form-error" role="alert">${encode(message)}</p>` : ''}<label>Username<input name="username" autocomplete="username" spellcheck="false" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Enter Console</button></form></main></body></html>`;
  const shell = async nonce => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nolen SOC</title><link rel="stylesheet" href="/assets/styles.css"></head><body><a class="skip" href="#workspace">Skip to investigation</a><div id="app"><div class="boot" role="status">Loading investigation workspace…</div></div><script type="module" nonce="${nonce}">${await readFile(new URL('app.js', assetDirectory), 'utf8')}</script></body></html>`;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://console.local');
    try {
      if (request.method === 'GET' && url.pathname === '/assets/styles.css') return send(response, 200, await readFile(new URL('styles.css', assetDirectory)), { 'content-type': 'text/css; charset=utf-8' });
      if (request.method === 'GET' && url.pathname === '/login') return send(response, 200, login(url.searchParams.has('failed') ? 'Invalid username or password.' : ''), { 'content-type': 'text/html; charset=utf-8' });
      if (request.method === 'POST' && url.pathname === '/session') {
        const form = new URLSearchParams(await body(request)), user = users[form.get('username')];
        if (!user || user.revoked || !equal(form.get('password'), user.password)) return send(response, 303, '', { location: '/login?failed=1' });
        const id = randomBytes(32).toString('base64url');
        sessions.set(id, { username: form.get('username'), role: user.role, csrf: randomBytes(24).toString('base64url'), expiresAt: now() + sessionTtlMs });
        return send(response, 303, '', { location: '/', 'set-cookie': `nolen_session=${id}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${Math.floor(sessionTtlMs / 1000)}` });
      }
      if (request.method === 'POST' && url.pathname === '/logout') {
        const current = authorized(request, response); if (!current || !mutationAllowed(request, response, current)) return;
        sessions.delete(current.id); for (const stream of streams.get(current.id) ?? []) stream.end(); streams.delete(current.id);
        return send(response, 303, '', { location: '/login', 'set-cookie': `nolen_session=; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=0` });
      }
      if (request.method === 'GET' && url.pathname === '/api/session') { const current = authorized(request, response); return current && json(response, 200, { username: current.username, role: current.role, csrf: current.csrf }); }
      if (request.method === 'GET' && url.pathname === '/api/incidents') { const current = authorized(request, response); return current && json(response, 200, { incidents: await incidentRepository.list({ limit: 50 }) }); }
      if (request.method === 'GET' && url.pathname === '/api/ml/shadow-enrichment') {
        const current = authorized(request, response); if (!current) return;
        try { return json(response, 200, await shadowEnrichmentRepository.read({ limit: 50 })); }
        catch { return json(response, 503, { error: 'shadow_enrichment_unavailable' }); }
      }
      if (request.method === 'GET' && url.pathname === '/api/events') { const current = authorized(request, response); return current && json(response, 200, { events: await eventRepository.search(Object.fromEntries(url.searchParams)) }); }
      if (request.method === 'GET' && url.pathname === '/api/agents') { const current = authorized(request, response); return current && json(response, 200, { agents }); }
      if (request.method === 'GET' && url.pathname === '/api/rules') { const current = authorized(request, response); return current && json(response, 200, { rules }); }
      if (request.method === 'POST' && /^\/api\/incidents\/[^/]+\/status$/.test(url.pathname)) {
        const current = authorized(request, response, ['admin']); if (!current || !mutationAllowed(request, response, current)) return;
        const input = JSON.parse(await body(request)), status = input.status;
        if (!['open', 'investigating', 'resolved'].includes(status)) return json(response, 422, { error: 'invalid_incident_status' });
        const id = decodeURIComponent(url.pathname.split('/')[3]), updated = await incidentRepository.updateStatus(id, status, current.username);
        if (!updated) return json(response, 404, { error: 'not_found' });
        if (updated.previousStatus === status) return json(response, 409, { error: 'status_unchanged' });
        const { previousStatus, ...incident } = updated;
        return json(response, 200, { incident });
      }
      if (request.method === 'GET' && url.pathname === '/api/stream/incidents') {
        const current = authorized(request, response); if (!current) return;
        response.writeHead(200, { ...securityHeaders(randomBytes(12).toString('base64')), 'content-type': 'text/event-stream', connection: 'keep-alive' });
        response.flushHeaders();
        const active = streams.get(current.id) ?? new Set(); active.add(response); streams.set(current.id, active);
        request.on('close', () => { active.delete(response); if (!active.size) streams.delete(current.id); }); return;
      }
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/incidents/') || url.pathname === '/events' || url.pathname === '/endpoints' || url.pathname === '/ml-advisory')) {
        if (!session(request)) return send(response, 303, '', { location: '/login' });
        const nonce = randomBytes(18).toString('base64'); return send(response, 200, await shell(nonce), { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': securityHeaders(nonce)['content-security-policy'] });
      }
      return json(response, 404, { error: 'not_found' });
    } catch (error) { return json(response, error instanceof SyntaxError ? 400 : 500, { error: error instanceof SyntaxError ? 'invalid_request' : 'request_failed' }); }
  });
  server.publishIncident = incident => {
    const payload = `event: incident\ndata: ${JSON.stringify(incident)}\n\n`;
    for (const [id, responses] of streams) {
      if (!sessions.has(id)) { for (const response of responses) response.end(); streams.delete(id); continue; }
      for (const response of responses) response.write(payload);
    }
  };
  server.revokeUser = username => { for (const [id, value] of sessions) if (value.username === username) { sessions.delete(id); for (const response of streams.get(id) ?? []) response.end(); streams.delete(id); } };
  return server;
}
