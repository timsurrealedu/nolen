import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../dataset/generate.js';
import { buildFeatureTable } from './feature-table.js';
import { evaluate, evaluateBaselines, predictProbability, ruleBaselinePrediction, selectOperatingThreshold, trainLogisticRegression } from './baseline.js';

test('trains an ML baseline only on the training partition and evaluates both baselines', () => {
  const dataset = generateDataset({ seed: 21, hostCount: 6, normalSessionsPerHost: 5, attackRuns: 6 });
  const { rows } = buildFeatureTable(dataset.events, dataset.labels);
  const { model, report } = evaluateBaselines(rows);
  assert.equal(model.type, 'logistic_regression');
  assert.ok(report.split.training_windows > 0);
  assert.ok(report.split.test_windows > 0);
  assert.deepEqual(Object.keys(report.model_feature_weights), model.feature_columns);
  assert.equal(report.logistic_regression_baseline.evaluated_windows, report.split.test_windows);
  assert.equal(report.deterministic_rules_baseline.evaluated_windows, report.split.test_windows);
  assert.ok(report.logistic_regression_baseline.accuracy >= 0 && report.logistic_regression_baseline.accuracy <= 1);
  assert.equal(report.class_distribution.training.malicious + report.class_distribution.training.normal, report.split.training_windows);
  assert.equal(report.class_distribution.test.malicious + report.class_distribution.test.normal, report.split.test_windows);
  assert.ok(report.logistic_regression_baseline.average_precision >= 0 && report.logistic_regression_baseline.average_precision <= 1);
  assert.equal(report.logistic_regression_baseline.precision_recall_by_threshold.length, 9);
  assert.equal(report.threshold_selection.split, 'train');
  assert.equal(model.threshold, report.threshold_selection.threshold);
});

test('selects an operating threshold from training rows only', () => {
  const rows = [{ label: 'normal', score: 0.1 }, { label: 'malicious', score: 0.8 }, { label: 'malicious', score: 0.9 }];
  const selection = selectOperatingThreshold(rows, row => row.score);
  assert.equal(selection.threshold, 0.8);
  assert.equal(selection.metrics.precision, 1);
  assert.equal(selection.metrics.recall, 1);
});

test('reports false alerts per observed host day', () => {
  const rows = [{ label: 'normal', host_id: 'h-1', window_start: '2026-01-01T00:00:00.000Z' }, { label: 'normal', host_id: 'h-2', window_start: '2026-01-01T00:00:00.000Z' }];
  const report = evaluate(rows, () => true);
  assert.equal(report.false_alerts_per_host_day, 1);
  assert.equal(report.false_alert_host_days, 2);
});

test('keeps the deterministic brute-force threshold separate from ML probabilities', () => {
  const rows = [
    { split: 'train', failed_login_count: 0, event_count: 1, invalid_user_count: 0, successful_login_count: 0, distinct_user_count: 1, elevated_shell_count: 0, sensitive_file_access_count: 0, cron_modify_count: 0, is_malicious: false },
    { split: 'train', failed_login_count: 10, event_count: 10, invalid_user_count: 0, successful_login_count: 0, distinct_user_count: 1, elevated_shell_count: 0, sensitive_file_access_count: 0, cron_modify_count: 0, is_malicious: true }
  ];
  const model = trainLogisticRegression(rows, { iterations: 100 });
  assert.equal(ruleBaselinePrediction(rows[0]), 0);
  assert.equal(ruleBaselinePrediction(rows[1]), 1);
  assert.ok(predictProbability(model, rows[1]) > predictProbability(model, rows[0]));
});
