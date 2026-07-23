import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDataset } from '../dataset/generate.js';
import { evaluateBaselines } from './baseline.js';
import { buildFeatureTable } from './feature-table.js';
import { createShadowEnrichment } from './shadow-enrichment.js';

test('creates an explainable advisory-only ML shadow enrichment', () => {
  const dataset = generateDataset({ seed: 9, hostCount: 4, normalSessionsPerHost: 4, attackRuns: 4 });
  const { rows } = buildFeatureTable(dataset.events, dataset.labels);
  const { model } = evaluateBaselines(rows);
  const row = rows.find(candidate => candidate.split === 'test');
  const enrichment = createShadowEnrichment(model, row, { dataQualityStatus: 'ready_with_warnings' });
  assert.equal(enrichment.enrichment_type, 'ml_advisory_shadow');
  assert.equal(enrichment.advisory_only, true);
  assert.match(enrichment.policy, /cannot create, suppress, close, reprioritize, or modify/i);
  assert.ok(enrichment.probability >= 0 && enrichment.probability <= 1);
  assert.ok(['low', 'medium', 'high'].includes(enrichment.risk_band));
  assert.equal(enrichment.top_features.length, 3);
  assert.equal('incident_id' in enrichment, false);
  assert.equal('status' in enrichment, false);
});

test('refuses enrichment rows without a canonical entity or numeric features', () => {
  const model = { type: 'logistic_regression', statistics: {}, weights: [], bias: 0 };
  assert.throws(() => createShadowEnrichment(model, {}), /canonical ML entity/i);
});
