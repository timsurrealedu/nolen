import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { validateEvent } from '../../packages/nef/src/validate.js';
import { entityForEvent } from '../ml/feature-table.js';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const header = /^(?<month>[A-Z][a-z]{2})\s+(?<day>\d{1,2})\s+(?<time>\d{2}:\d{2}:\d{2})\s+(?<host>\S+)\s+sshd\[\d+\]:\s+(?<message>.*)$/;
const failure = /^Failed \S+ for (?:(invalid user) )?(\S+) from (\S+) port \d+/;
const success = /^Accepted \S+ for (\S+) from (\S+) port \d+/;

export function parseOpenSshLine(line, { year, lineNumber, source = 'OpenSSH_2k.log' }) {
  const parsed = line.match(header)?.groups;
  if (!parsed) return null;
  const outcome = parsed.message.match(failure) ?? parsed.message.match(success);
  const isFailure = outcome?.[0]?.startsWith('Failed');
  const userName = isFailure ? outcome?.[2] : outcome?.[1];
  const sourceIp = isFailure ? outcome?.[3] : outcome?.[2];
  if (!outcome || isIP(sourceIp) === 0) return null;
  const month = months.indexOf(parsed.month);
  if (month < 0) return null;
  const [hours, minutes, seconds] = parsed.time.split(':').map(Number);
  const invalidUser = isFailure && outcome[1] === 'invalid user';
  const digest = createHash('sha256').update(`${source}:${lineNumber}:${line}`).digest('hex').slice(0, 16);
  return {
    nef_version: '1.0',
    id: `loghub-openssh-${lineNumber}-${digest}`,
    timestamp: new Date(Date.UTC(year, month, Number(parsed.day), hours, minutes, seconds)).toISOString(),
    host: { id: `loghub:${parsed.host}`, name: parsed.host },
    user: { name: userName },
    source: { ip: sourceIp },
    service: { name: 'ssh' },
    event: { category: 'authentication', action: invalidUser ? 'invalid_user' : 'login', result: isFailure ? 'failure' : 'success' }
  };
}

function profile(events) {
  const windows = new Map();
  for (const event of events) {
    const entity = entityForEvent(event);
    const window = new Date(Math.floor(Date.parse(event.timestamp) / 300000) * 300000).toISOString();
    const key = `${window}|${entity.entity_type}|${entity.host_id}|${entity.source_ip}|${entity.user_name ?? '<absent>'}`;
    windows.set(key, (windows.get(key) ?? 0) + 1);
  }
  return {
    event_count: events.length,
    failure_count: events.filter(event => event.event.result === 'failure').length,
    success_count: events.filter(event => event.event.result === 'success').length,
    invalid_user_count: events.filter(event => event.event.action === 'invalid_user').length,
    distinct_source_ip_count: new Set(events.map(event => event.source.ip)).size,
    five_minute_entity_windows: windows.size,
    windows_with_ten_or_more_events: [...windows.values()].filter(count => count >= 10).length
  };
}

export async function importLoghubOpenSsh({ inputPath = new URL('../../data/raw/loghub-openssh/OpenSSH_2k.log', import.meta.url), outputPath = new URL('../../data/processed/loghub-openssh/events.jsonl', import.meta.url), reportPath = new URL('../../data/processed/loghub-openssh/import-report.json', import.meta.url), year } = {}) {
  if (!Number.isInteger(year) || year < 1970 || year > 2100) throw new Error('Provide the source log year with LOGHUB_START_YEAR (for example, 2017).');
  const lines = (await readFile(inputPath, 'utf8')).split(/\r?\n/).filter(Boolean);
  const events = lines.map((line, index) => parseOpenSshLine(line, { year, lineNumber: index + 1 })).filter(Boolean);
  const invalid = events.map(event => ({ id: event.id, errors: validateEvent(event).errors })).filter(result => result.errors.length);
  if (invalid.length) throw new Error(`OpenSSH import produced invalid NEF: ${invalid[0].id}`);
  const report = {
    source: { name: 'LogHub OpenSSH_2k', raw_file: 'data/raw/loghub-openssh/OpenSSH_2k.log', labels: 'none', training_eligibility: 'not eligible for supervised training without reviewed external ground truth' },
    timestamp_assumption: { year, note: 'The source omits a year; this supplied year makes timestamps schema-valid and must not be treated as source ground truth.' },
    input_line_count: lines.length,
    mapped_event_count: events.length,
    ignored_line_count: lines.length - events.length,
    profile: profile(events)
  };
  await Promise.all([outputPath, reportPath].map(path => mkdir(dirname(fileURLToPath(path)), { recursive: true })));
  await Promise.all([
    writeFile(outputPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`),
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  ]);
  return report;
}
