import { readFile } from 'node:fs/promises';
import { sshCompromiseEvents } from '../simulations/ssh-compromise/fixture.js';

const phase = process.argv[2] ?? 'all', runId = process.argv[3] ?? String(Date.now()), source = sshCompromiseEvents(), sourceStart = Date.parse(source[0].timestamp), liveStart = Number(runId);
const events = source.map(event => ({ ...event, id: `${event.id}-${runId}`, timestamp: new Date(liveStart + Date.parse(event.timestamp) - sourceStart).toISOString() }));
const secret = async name => (await readFile(`secrets/${name}`, 'utf8')).trim();
const ingest = async selected => {
  const response = await fetch('http://127.0.0.1:3001/v1/ingest/events', { method: 'POST', headers: { authorization: `Bearer ${await secret('agent_token')}`, 'content-type': 'application/json' }, body: JSON.stringify({ events: selected }) });
  if (response.status !== 202) throw new Error(`ingestion returned ${response.status}: ${await response.text()}`);
};
const verify = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch('http://127.0.0.1:3002/v1/incidents', { headers: { authorization: `Bearer ${await secret('analyst_token')}` } });
    const incident = (await response.json()).incidents?.find(item => item.title === 'Probable SSH Account Compromise');
    if (incident) { console.log(JSON.stringify({ status: 'verified', incidentId: incident.id, evidenceCount: incident.evidenceEventIds.length })); return; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('live incident was not delivered to the API');
};

if (phase === 'precursor') { await ingest(events.slice(0, -1)); console.log(JSON.stringify({ status: 'precursor_sent', runId })); }
else if (phase === 'complete') await ingest(events.slice(-1));
else { await ingest(events); await verify(); }
if (phase === 'verify') await verify();
