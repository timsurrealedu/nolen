import test from 'node:test';
import assert from 'node:assert/strict';
import { MlInputBlockedError, assertMlBuildAllowed } from './run-pipeline.js';

test('stops the ML pipeline when data quality has critical failures', () => {
  const report = { summary: { status: 'blocked', event_count: 2 }, findings: [{ severity: 'critical', id: 'duplicate_event_ids' }] };
  assert.throws(() => assertMlBuildAllowed(report), MlInputBlockedError);
});

test('permits ML experiments with documented non-critical warnings', () => {
  const report = { summary: { status: 'ready_with_warnings', event_count: 10 }, findings: [{ severity: 'medium', id: 'class_imbalance' }] };
  assert.equal(assertMlBuildAllowed(report), report);
});
