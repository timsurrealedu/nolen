import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEvent, validateEvent } from '../src/validate.js';
import { sshCompromiseEvents } from '../../../simulations/ssh-compromise/fixture.js';
import { normalOperationsEvents } from '../../../simulations/normal-operations/fixture.js';

const base = { nef_version: '1.0', id: 'evt-1', timestamp: '2026-07-15T14:32:00Z', host: { id: 'host-1' } };
const failure = { ...base, event: { category: 'authentication', action: 'login', result: 'failure' }, source: { ip: '198.51.100.44' }, service: { name: 'ssh' } };

test('accepts known-user and unknown-user SSH failures without coercing the username', () => {
  assert.equal(validateEvent({ ...failure, user: { name: 'deploy' } }).valid, true);
  assert.equal(validateEvent(failure).valid, true);
  assert.equal(Object.hasOwn(failure, 'user'), false);
});

test('requires a username for successful SSH logins', () => {
  const result = validateEvent({ ...failure, event: { category: 'authentication', action: 'login', result: 'success' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('successful login requires user.name'));
});

test('rejects invalid enums, timestamps, and source IPs', () => {
  const result = validateEvent({ ...failure, timestamp: 'not-a-time', source: { ip: '999.999.999.999' }, event: { category: 'authentication', action: 'logout', result: 'maybe' } });
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 4);
});

test('validates all current normal and SSH-compromise fixtures', () => {
  for (const event of [...sshCompromiseEvents(), ...normalOperationsEvents()]) {
    assert.deepEqual(validateEvent(event), { valid: true, errors: [] }, event.id);
  }
});

test('redacts command-line secrets before validation or persistence', () => {
  const raw = { ...base, event: { category: 'process', action: 'start' }, user: { name: 'deploy' }, process: { name: 'curl', pid: 42, privilege: 'standard', command_line: 'curl --password hunter2 -H Authorization: Bearer abc123 https://user:pass@example.test' } };
  const { event, redacted } = sanitizeEvent(raw);
  assert.equal(redacted, true);
  assert.doesNotMatch(JSON.stringify(event), /hunter2|abc123|user:pass/);
  assert.equal(validateEvent(event).valid, true);
});
