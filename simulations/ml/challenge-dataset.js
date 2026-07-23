// This generator intentionally does not reuse the training dataset scenarios.
// It provides an out-of-distribution check, not additional training data.
const iso = milliseconds => new Date(milliseconds).toISOString();

export const CHALLENGE_EXPECTATIONS = Object.freeze({
  challenge_benign_retries: { expectedRuleIds: [], expectedIncidentCount: 0 },
  challenge_low_volume_brute_force: { expectedRuleIds: [], expectedIncidentCount: 0 },
  challenge_slow_brute_force: { expectedRuleIds: [], expectedIncidentCount: 0 },
  challenge_low_slow_compromise: { expectedRuleIds: ['NOLEN-FILE-001', 'NOLEN-PROC-001'], expectedIncidentCount: 0 },
  challenge_success_after_threshold: { expectedRuleIds: ['NOLEN-SEQ-001', 'NOLEN-SSH-001'], expectedIncidentCount: 0 },
  challenge_success_source_change: { expectedRuleIds: ['NOLEN-PROC-001', 'NOLEN-SSH-001'], expectedIncidentCount: 0 },
  challenge_complete_compromise: { expectedRuleIds: ['NOLEN-PROC-001', 'NOLEN-SEQ-001', 'NOLEN-SSH-001'], expectedIncidentCount: 1 }
});

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

  const scenario = (name, run) => startedAt + (Object.keys(CHALLENGE_EXPECTATIONS).indexOf(name) * runs + run) * 11 * 60_000;
  const login = (timestamp, machine, ip, user, result) => ({ timestamp: iso(timestamp), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result } });
  const shell = (timestamp, machine, ip, user, name = 'bash') => ({ timestamp: iso(timestamp), host: machine, user: { name: user }, source: { ip }, event: { category: 'process', action: 'start' }, process: { name, pid: 30_000 + sequence, privilege: 'elevated' } });

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_benign_retries', run);
    const machine = host(run), ip = source(run), user = run % 2 === 0 ? 'operations' : 'release';
    // Eight failed passwords and a later success: benign but deliberately close to the rule threshold.
    for (let attempt = 0; attempt < 8; attempt += 1) add({ scenario: 'challenge_benign_retries', label: 'normal', body: { timestamp: iso(timestamp + attempt * 8_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } } });
    add({ scenario: 'challenge_benign_retries', label: 'normal', body: { timestamp: iso(timestamp + 75_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_low_volume_brute_force', run);
    const machine = host(run + 1), ip = source(run + 20), user = run % 2 === 0 ? 'backup' : 'deploy';
    for (let attempt = 0; attempt < 9; attempt += 1) add({ scenario: 'challenge_low_volume_brute_force', label: 'brute_force', body: login(timestamp + attempt * 4_000, machine, ip, user, 'failure') });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_slow_brute_force', run);
    const machine = host(run + 2), ip = source(run + 40), user = run % 2 === 0 ? 'alice' : 'bob';
    for (let attempt = 0; attempt < 10; attempt += 1) add({ scenario: 'challenge_slow_brute_force', label: 'brute_force', body: login(timestamp + attempt * 15_000, machine, ip, user, 'failure') });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_low_slow_compromise', run);
    const machine = host(run + 2), ip = source(run + 40), user = run % 2 === 0 ? 'alice' : 'bob';
    // A successful, low-and-slow compromise may be malicious before ten failures occur.
    for (let attempt = 0; attempt < 6; attempt += 1) add({ scenario: 'challenge_low_slow_compromise', label: 'brute_force', body: { timestamp: iso(timestamp + attempt * 12_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'failure' } } });
    add({ scenario: 'challenge_low_slow_compromise', label: 'successful_compromise', body: { timestamp: iso(timestamp + 78_000), host: machine, user: { name: user }, source: { ip }, service: { name: 'ssh' }, event: { category: 'authentication', action: 'login', result: 'success' } } });
    add({ scenario: 'challenge_low_slow_compromise', label: 'privileged_activity', body: { timestamp: iso(timestamp + 94_000), host: machine, user: { name: user }, source: { ip }, event: { category: 'process', action: 'start' }, process: { name: 'bash', pid: 30_000 + sequence, privilege: 'elevated' } } });
    add({ scenario: 'challenge_low_slow_compromise', label: 'sensitive_file_access', body: { timestamp: iso(timestamp + 110_000), host: machine, user: { name: user }, source: { ip }, event: { category: 'file', action: 'access' }, file: { path: '/etc/shadow' } } });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_success_after_threshold', run);
    const machine = host(run + 3), ip = source(run + 60), user = run % 2 === 0 ? 'service' : 'analyst';
    for (let attempt = 0; attempt < 10; attempt += 1) add({ scenario: 'challenge_success_after_threshold', label: 'brute_force', body: login(timestamp + attempt * 2_000, machine, ip, user, 'failure') });
    add({ scenario: 'challenge_success_after_threshold', label: 'successful_compromise', body: login(timestamp + 25_000, machine, ip, user, 'success') });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_success_source_change', run);
    const machine = host(run + 4), ip = source(run + 80), user = run % 2 === 0 ? 'release' : 'operations';
    for (let attempt = 0; attempt < 10; attempt += 1) add({ scenario: 'challenge_success_source_change', label: 'brute_force', body: login(timestamp + attempt * 2_000, machine, ip, user, 'failure') });
    add({ scenario: 'challenge_success_source_change', label: 'successful_compromise', body: login(timestamp + 25_000, machine, source(run + 100), user, 'success') });
    add({ scenario: 'challenge_success_source_change', label: 'privileged_activity', body: shell(timestamp + 35_000, machine, source(run + 100), user, 'zsh') });
  }

  for (let run = 0; run < runs; run += 1) {
    const timestamp = scenario('challenge_complete_compromise', run);
    const machine = host(run + 5), ip = source(run + 120), user = run % 2 === 0 ? 'monitor' : 'builder';
    for (let attempt = 0; attempt < 10; attempt += 1) add({ scenario: 'challenge_complete_compromise', label: 'brute_force', body: login(timestamp + attempt * 3_000, machine, ip, user, 'failure') });
    add({ scenario: 'challenge_complete_compromise', label: 'successful_compromise', body: login(timestamp + 35_000, machine, ip, user, 'success') });
    add({ scenario: 'challenge_complete_compromise', label: 'privileged_activity', body: shell(timestamp + 50_000, machine, ip, user, 'sh') });
  }

  const sortedEvents = events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  return {
    events: sortedEvents,
    labels,
    scenarios: Object.entries(CHALLENGE_EXPECTATIONS).map(([id, expectation]) => ({
      id,
      events: sortedEvents.filter(event => labels.find(label => label.event_id === event.id)?.scenario === id),
      expectedRuleIds: expectation.expectedRuleIds,
      expectedIncidentCount: expectation.expectedIncidentCount * runs
    }))
  };
}
