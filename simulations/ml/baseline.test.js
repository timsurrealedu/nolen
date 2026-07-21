import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../dataset/generate.js';
import { buildFeatureTable } from './feature-table.js';
import { evaluateBaselines, predictProbability, ruleBaselinePrediction, trainLogisticRegression } from './baseline.js';

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
