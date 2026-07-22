import test from 'node:test';
import assert from 'node:assert/strict';
import { duration, loadRules, parseRule } from '../src/load.js';

test('loads every repository rule with unique IDs', () => {
  assert.deepEqual([...loadRules().keys()], ['NOLEN-CORR-001', 'NOLEN-FILE-001', 'NOLEN-PROC-001', 'NOLEN-SEQ-001', 'NOLEN-SSH-001', 'NOLEN-SSH-002', 'NOLEN-SSH-003']);
});

test('validates required fields and durations', () => {
  assert.equal(duration('5m'), 300_000);
  assert.throws(() => duration('5 minutes'), /invalid rule duration/);
  assert.throws(() => parseRule('id: incomplete'), /name is required/);
  assert.throws(() => parseRule('id: X\nname: X\nseverity: low\nmatch: {}\ncondition: { count: 0, within: 1m }'), /positive integer/);
  assert.throws(() => parseRule('id: X\nname: X\nseverity: low\nrequires: [A, B]\nsame: [host.id]\nconfidence: 101'), /confidence/);
});
