const root = document.querySelector('#app');
const state = { session: null, incidents: [], events: [], agents: [], view: location.pathname === '/events' ? 'events' : location.pathname === '/endpoints' ? 'endpoints' : 'incidents' };
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const el = (tag, options = {}, children = []) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(options)) key === 'class' ? node.className = value : key.startsWith('on') ? node.addEventListener(key.slice(2).toLowerCase(), value) : node.setAttribute(key, value); for (const child of [].concat(children)) node.append(child?.nodeType ? child : document.createTextNode(String(child ?? ''))); return node; };
const request = async (path, options) => { const response = await fetch(path, { credentials: 'same-origin', ...options }); if (response.status === 401) location.assign('/login'); if (!response.ok) throw new Error(response.status === 403 ? 'Your role cannot perform this action.' : 'The request could not be completed.'); return response.json(); };
const severity = value => el('span', { class: `severity severity-${value}` }, [value]);
const empty = (title, detail) => el('div', { class: 'empty' }, [el('h3', {}, [title]), el('p', {}, [detail])]);

function nav() {
  const links = [['incidents', 'Incidents', '/'], ['events', 'Event Explorer', '/events'], ['endpoints', 'Endpoints', '/endpoints']];
  return el('aside', { class: 'rail' }, [
    el('div', { class: 'brand' }, [el('span', { class: 'brand-mark', 'aria-hidden': 'true' }, ['N']), el('span', {}, ['Nolen'])]),
    el('nav', { 'aria-label': 'Primary' }, links.map(([id, label, href]) => el('a', { href, class: state.view === id ? 'active' : '', ...(state.view === id ? { 'aria-current': 'page' } : {}) }, [label]))),
    el('div', { class: 'identity' }, [el('span', {}, [state.session.username]), el('small', {}, [state.session.role]), el('button', { type: 'button', class: 'quiet', onclick: logout }, ['Sign out'])])
  ]);
}

function header(title, summary) { return el('header', { class: 'workspace-header' }, [el('div', {}, [el('h1', {}, [title]), el('p', {}, [summary])]), el('span', { class: 'live-state' }, ['Live'])]); }

function incidentTable() {
  if (!state.incidents.length) return empty('No incidents yet', 'Completed detection sequences will appear here with their supporting evidence.');
  const rows = state.incidents.map(incident => el('tr', {}, [
    el('td', {}, [severity(incident.severity)]), el('td', {}, [el('button', { type: 'button', class: 'incident-link', onclick: () => openIncident(incident) }, [incident.title]), el('small', {}, [incident.entities?.hostId ?? 'Unknown host'])]),
    el('td', {}, [incident.status]), el('td', {}, [`${incident.confidence}%`]), el('td', {}, [dateTime.format(new Date(incident.createdAt))])
  ]));
  return el('div', { class: 'table-wrap' }, [el('table', {}, [el('thead', {}, [el('tr', {}, ['Severity', 'Incident', 'Status', 'Confidence', 'Created'].map(label => el('th', { scope: 'col' }, [label])))]), el('tbody', {}, rows)])]);
}

function incidentsView() {
  const active = state.incidents.filter(item => item.status !== 'resolved').length, critical = state.incidents.filter(item => item.severity === 'critical').length;
  return [header('Incident Queue', 'Deterministic detections ready for analyst review.'), el('section', { class: 'metrics', 'aria-label': 'Current posture' }, [
    el('div', {}, [el('strong', {}, [active]), el('span', {}, ['Active incidents'])]), el('div', {}, [el('strong', {}, [critical]), el('span', {}, ['Critical incidents'])]), el('div', {}, [el('strong', {}, [state.agents.filter(item => item.status === 'online').length]), el('span', {}, ['Endpoints online'])])
  ]), el('section', { class: 'section' }, [el('div', { class: 'section-heading' }, [el('h2', {}, ['Recent Incidents']), el('span', {}, [`${state.incidents.length} total`])]), incidentTable()])];
}

function eventsView() {
  const form = el('form', { class: 'filters', onsubmit: searchEvents }, [el('label', {}, ['Host', el('input', { name: 'hostId', placeholder: 'e.g. host-01…', autocomplete: 'off', spellcheck: 'false' })]), el('label', {}, ['Category', el('select', { name: 'category' }, [el('option', { value: '' }, ['All']), ...['authentication', 'process', 'file'].map(value => el('option', { value }, [value]))])]), el('label', {}, ['Result', el('select', { name: 'result' }, [el('option', { value: '' }, ['All']), el('option', { value: 'success' }, ['success']), el('option', { value: 'failure' }, ['failure'])])]), el('button', { type: 'submit' }, ['Search'])]);
  const results = state.events.length ? el('div', { class: 'event-list' }, state.events.map(event => el('details', {}, [el('summary', {}, [el('span', {}, [event.event?.category ?? 'event']), el('strong', {}, [event.host?.id ?? 'Unknown host']), el('time', {}, [event.timestamp])]), el('pre', {}, [JSON.stringify(event, null, 2)])]))) : empty('Search stored telemetry', 'Filter by host, category, or result. Raw NEF remains collapsed until selected.');
  return [header('Event Explorer', 'Inspect normalized evidence without losing its original structure.'), el('section', { class: 'section' }, [form, results])];
}

function endpointsView() {
  const list = state.agents.length ? el('div', { class: 'endpoint-list' }, state.agents.map(agent => el('article', {}, [
    el('div', {}, [el('span', { class: `dot dot-${agent.status}`, 'aria-hidden': 'true' }), el('h2', {}, [agent.hostname])]),
    el('dl', {}, [
      el('div', {}, [el('dt', {}, ['Status']), el('dd', {}, [agent.status])]),
      el('div', {}, [el('dt', {}, ['Agent']), el('dd', {}, [agent.version ?? 'Unknown'])]),
      el('div', {}, [el('dt', {}, ['Last heartbeat']), el('dd', {}, [agent.lastHeartbeat ? dateTime.format(new Date(agent.lastHeartbeat)) : 'Never'])])
    ])
  ]))) : empty('No enrolled endpoints', 'Provision an agent credential to begin monitoring a Linux endpoint.');
  return [header('Endpoint Status', 'Enrollment and heartbeat state for monitored systems.'), el('section', { class: 'section' }, [list])];
}

function openIncident(incident) {
  history.pushState({}, '', `/incidents/${encodeURIComponent(incident.id)}`);
  const timeline = (incident.evidenceEventIds ?? []).map((id, index) => el('li', {}, [el('span', {}, [String(index + 1)]), el('code', {}, [id])]));
  const statusControl = state.session.role === 'admin' ? el('form', { class: 'status-control', onsubmit: event => updateStatus(event, incident, detail) }, [el('label', {}, ['Update Status', el('select', { name: 'status' }, ['open', 'investigating', 'resolved'].map(value => el('option', { value, ...(value === incident.status ? { selected: '' } : {}) }, [value])))]), el('button', { type: 'submit' }, ['Save Status'])]) : null;
  const detail = el('dialog', { class: 'incident-dialog', 'aria-labelledby': 'incident-title' }, [el('div', { class: 'dialog-head' }, [el('div', {}, [severity(incident.severity), el('h2', { id: 'incident-title' }, [incident.title])]), el('button', { type: 'button', class: 'quiet', onclick: () => { detail.close(); history.pushState({}, '', '/'); } }, ['Close'])]), el('div', { class: 'incident-meta' }, [el('div', {}, [el('span', {}, ['Confidence']), el('strong', {}, [`${incident.confidence}%`])]), el('div', {}, [el('span', {}, ['Status']), el('strong', {}, [incident.status])]), el('div', {}, [el('span', {}, ['Host']), el('strong', {}, [incident.entities?.hostId ?? 'Unknown'])]), el('div', {}, [el('span', {}, ['User']), el('strong', {}, [incident.entities?.user ?? 'Unknown'])])]), statusControl, el('h3', {}, ['ATT&CK Techniques']), el('div', { class: 'techniques' }, (incident.mitre ?? []).map(value => el('span', {}, [value]))), el('h3', {}, ['Evidence Timeline']), el('ol', { class: 'timeline' }, timeline)].filter(Boolean));
  document.body.append(detail); detail.addEventListener('close', () => detail.remove()); detail.showModal();
}

async function searchEvents(event) { event.preventDefault(); const query = new URLSearchParams([...new FormData(event.currentTarget)].filter(([, value]) => value)); try { state.events = (await request(`/api/events?${query}`)).events; render(); } catch (error) { showError(error.message); } }
async function updateStatus(event, incident, detail) { event.preventDefault(); try { const { incident: updated } = await request(`/api/incidents/${encodeURIComponent(incident.id)}/status`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': state.session.csrf }, body: JSON.stringify({ status: new FormData(event.currentTarget).get('status') }) }); state.incidents = state.incidents.map(item => item.id === updated.id ? updated : item); detail.close(); render(); } catch (error) { showError(error.message); } }
async function logout() { await fetch('/logout', { method: 'POST', credentials: 'same-origin', headers: { origin: location.origin, 'x-csrf-token': state.session.csrf } }); location.assign('/login'); }
function showError(message) { root.prepend(el('div', { class: 'notice', role: 'alert' }, [message])); }
function render() { root.replaceChildren(nav(), el('main', { id: 'workspace', class: 'workspace', tabindex: '-1' }, state.view === 'events' ? eventsView() : state.view === 'endpoints' ? endpointsView() : incidentsView())); }

try {
  [state.session, { incidents: state.incidents }, { agents: state.agents }] = await Promise.all([request('/api/session'), request('/api/incidents'), request('/api/agents')]);
  render();
  const stream = new EventSource('/api/stream/incidents');
  stream.addEventListener('incident', event => { const incident = JSON.parse(event.data); if (!state.incidents.some(item => item.id === incident.id)) state.incidents.unshift(incident); if (state.view === 'incidents') render(); });
  stream.onerror = () => { document.querySelector('.live-state')?.replaceChildren('Reconnecting'); };
} catch (error) { showError(error.message); }
