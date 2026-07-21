import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const users = ['alice', 'bob', 'carol', 'deploy', 'ops'];
const processNames = ['bash', 'vim', 'systemctl', 'journalctl', 'git'];
const scenarios = ['normal_operations', 'ssh_brute_force', 'invalid_user_enumeration', 'authorized_maintenance', 'ssh_compromise'];

const random = seed => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const pick = (values, next) => values[Math.floor(next() * values.length)];
const iso = milliseconds => new Date(milliseconds).toISOString();
const normalIp = (index, offset) => `10.20.${Math.floor(index / 200) + 1}.${(index + offset) % 200 + 10}`;
const attackIp = (index, offset = 0) => `203.0.113.${(index + offset) % 200 + 10}`;

export function generateDataset({ seed = 20260721, hostCount = 24, normalSessionsPerHost = 30, attackRuns = 24, start = '2026-01-01T00:00:00.000Z' } = {}) {
  const next = random(seed), events = [], labels = [];
  let sequence = 0;
  const startedAt = Date.parse(start);
  const add = ({ scenario, stage, label, isMalicious, body }) => {
    sequence += 1;
    const id = `gen-${String(sequence).padStart(7, '0')}`;
    const event = { nef_version: '1.0', id, ...body };
    events.push(event);
    labels.push({ event_id: id, scenario, stage, label, is_malicious: String(isMalicious) });
  };
  const host = index => ({ id: `host-${String(index).padStart(3, '0')}`, name: `lab-${String(index).padStart(3, '0')}` });
  const time = () => startedAt + Math.floor(next() * 60 * 60 * 24 * 30) * 1_000;

  for (let index = 1; index <= hostCount; index += 1) {
    for (let session = 0; session < normalSessionsPerHost; session += 1) {
      const timestamp = time(), identity = pick(users, next), machine = host(index), source = normalIp(index, session);
      add({ scenario: 'normal_operations', stage: 'normal_session', label: 'normal', isMalicious: false, body: { timestamp: iso(timestamp), host: machine, user: { name: identity }, source: { ip: source }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
      add({ scenario: 'normal_operations', stage: 'normal_session', label: 'normal', isMalicious: false, body: { timestamp: iso(timestamp + 2_000), host: machine, user: { name: identity }, source: { ip: source }, event: { category: 'process', action: 'start' }, process: { name: pick(processNames, next), pid: 1_000 + sequence, privilege: 'standard' } } });
      if (session % 4 === 0) add({ scenario: 'normal_operations', stage: 'routine_file_access', label: 'normal', isMalicious: false, body: { timestamp: iso(timestamp + 4_000), host: machine, user: { name: identity }, source: { ip: source }, event: { category: 'file', action: 'access' }, file: { path: '/etc/passwd' } } });
    }
  }

  for (let run = 0; run < attackRuns; run += 1) {
    const timestamp = time(), machine = host(run % hostCount + 1), identity = pick(users, next), source = attackIp(run);
    for (let attempt = 0; attempt < 10; attempt += 1) add({ scenario: 'ssh_brute_force', stage: 'credential_access', label: 'brute_force', isMalicious: true, body: { timestamp: iso(timestamp + attempt * 3_000), host: machine, user: { name: identity }, source: { ip: source }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } } });
  }

  for (let run = 0; run < attackRuns; run += 1) {
    const timestamp = time(), machine = host((run + 5) % hostCount + 1), source = attackIp(run, 80);
    for (let attempt = 0; attempt < 5; attempt += 1) add({ scenario: 'invalid_user_enumeration', stage: 'account_enumeration', label: 'invalid_user_enumeration', isMalicious: false, body: { timestamp: iso(timestamp + attempt * 4_000), host: machine, user: { name: `ghost-${run}-${attempt}` }, source: { ip: source }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'invalid_user', result: 'failure' } } });
  }

  for (let run = 0; run < attackRuns; run += 1) {
    const timestamp = time(), machine = host((run + 10) % hostCount + 1), identity = 'ops', source = normalIp(run + 60, 0);
    add({ scenario: 'authorized_maintenance', stage: 'normal_session', label: 'authorized_maintenance', isMalicious: false, body: { timestamp: iso(timestamp), host: machine, user: { name: identity }, source: { ip: source }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
    add({ scenario: 'authorized_maintenance', stage: 'privileged_activity', label: 'authorized_maintenance', isMalicious: false, body: { timestamp: iso(timestamp + 3_000), host: machine, user: { name: identity }, source: { ip: source }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 8_000 + sequence, privilege: 'elevated' } } });
    add({ scenario: 'authorized_maintenance', stage: 'file_administration', label: 'authorized_maintenance', isMalicious: false, body: { timestamp: iso(timestamp + 6_000), host: machine, user: { name: identity }, source: { ip: source }, event: { category: 'file', action: 'modify' }, file: { path: run % 2 ? '/etc/sudoers' : '/etc/cron.d/maintenance' } } });
  }

  for (let run = 0; run < attackRuns; run += 1) {
    const timestamp = time(), machine = host((run + 15) % hostCount + 1), identity = pick(users, next), source = attackIp(run, 140);
    for (let attempt = 0; attempt < 10; attempt += 1) add({ scenario: 'ssh_compromise', stage: 'credential_access', label: 'brute_force', isMalicious: true, body: { timestamp: iso(timestamp + attempt * 2_000), host: machine, user: { name: identity }, source: { ip: source }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } } });
    add({ scenario: 'ssh_compromise', stage: 'initial_access', label: 'successful_compromise', isMalicious: true, body: { timestamp: iso(timestamp + 25_000), host: machine, user: { name: identity }, source: { ip: source }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
    add({ scenario: 'ssh_compromise', stage: 'privilege_escalation', label: 'privileged_activity', isMalicious: true, body: { timestamp: iso(timestamp + 31_000), host: machine, user: { name: identity }, source: { ip: source }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 12_000 + sequence, privilege: 'elevated' } } });
    add({ scenario: 'ssh_compromise', stage: 'credential_access', label: 'sensitive_file_access', isMalicious: true, body: { timestamp: iso(timestamp + 36_000), host: machine, user: { name: identity }, source: { ip: source }, event: { category: 'file', action: 'access' }, file: { path: '/etc/shadow' } } });
  }

  return { events: events.sort((left, right) => left.timestamp.localeCompare(right.timestamp)), labels, metadata: { seed, hostCount, normalSessionsPerHost, attackRuns, eventCount: events.length, scenarios } };
}

export async function writeDataset({ outputDirectory = new URL('./out/', import.meta.url), ...options } = {}) {
  const dataset = generateDataset(options), directory = fileURLToPath(outputDirectory);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, 'events.jsonl'), `${dataset.events.map(event => JSON.stringify(event)).join('\n')}\n`),
    writeFile(join(directory, 'labels.csv'), `event_id,scenario,stage,label,is_malicious\n${dataset.labels.map(label => Object.values(label).join(',')).join('\n')}\n`),
    writeFile(join(directory, 'metadata.json'), `${JSON.stringify(dataset.metadata, null, 2)}\n`)
  ]);
  return dataset.metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await writeDataset(), null, 2));
