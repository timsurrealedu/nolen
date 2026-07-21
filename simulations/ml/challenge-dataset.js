// This generator intentionally does not reuse the training dataset scenarios.
// It provides an out-of-distribution check, not additional training data.
const iso = milliseconds => new Date(milliseconds).toISOString();

export function generateChallengeDataset({ start = '2026-04-01T00:00:00.000Z', runs = 18 } = {}) {
  const events = [], labels = [];
  let sequence = 0;
  const startedAt = Date.parse(start);
  const add = ({ scenario, label, body }) => {
    sequence += 1;
    const id = `challenge-${String(sequence).padStart(6, '0')}`;
    events.push({ nef_version: '1.0', id, ...body });
    labels.push({ event_id: id, scenario, stage: scenario, label, is_malicious: String(['brute_force', 'successful_compromise', 'privileged_activity'].includes(label)) });
  };
  const host = index => ({ id: `challenge-host-${index % 6}`, name: `challenge-${index % 6}` });
  const source = index => `198.51.100.${20 + index}`;

  for (let run = 0; run < runs; run += 1) {
    const timestamp = startedAt + run * 11 * 60_000;
    const machine = host(run), ip = source(run), user = run % 2 === 0 ? 'operations' : 'release';
    // Eight failed passwords and a later success: benign but deliberately close to the rule threshold.
    for (let attempt = 0; attempt < 8; attempt += 1) add({ scenario: 'challenge_benign_retries', label: 'normal', body: { timestamp: iso(timestamp + attempt * 8_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } } });
    add({ scenario: 'challenge_benign_retries', label: 'normal', body: { timestamp: iso(timestamp + 75_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = startedAt + (runs + run) * 11 * 60_000;
    const machine = host(run + 2), ip = source(run + 40), user = run % 2 === 0 ? 'alice' : 'bob';
    // A successful, low-and-slow compromise may be malicious before ten failures occur.
    for (let attempt = 0; attempt < 6; attempt += 1) add({ scenario: 'challenge_low_slow_compromise', label: 'brute_force', body: { timestamp: iso(timestamp + attempt * 12_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } } });
    add({ scenario: 'challenge_low_slow_compromise', label: 'successful_compromise', body: { timestamp: iso(timestamp + 78_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
    add({ scenario: 'challenge_low_slow_compromise', label: 'privileged_activity', body: { timestamp: iso(timestamp + 94_000), host: machine, user: { name: user }, source: { ip }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 30_000 + sequence, privilege: 'elevated' } } });
    add({ scenario: 'challenge_low_slow_compromise', label: 'sensitive_file_access', body: { timestamp: iso(timestamp + 110_000), host: machine, user: { name: user }, source: { ip }, event: { category: 'file', action: 'access' }, file: { path: '/etc/shadow' } } });
  }
  return { events: events.sort((left, right) => left.timestamp.localeCompare(right.timestamp)), labels };
}
