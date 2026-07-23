import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createShadowEnrichmentRepository } from '../src/shadow-enrichment.js';

test('reads a bounded advisory-only shadow enrichment report', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'nolen-shadow-')), 'report.json');
  await writeFile(path, JSON.stringify({ report_type: 'ml_advisory_shadow_enrichment', advisory_only: true, model_version: 'ml-baseline-v1', data_quality_status: 'ready_with_warnings', enrichment_count: 2, enrichments: [{ risk_band: 'high' }, { risk_band: 'low' }] }));
  const report = await createShadowEnrichmentRepository({ reportPath: path }).read({ limit: 1 });
  assert.deepEqual(report.enrichments, [{ risk_band: 'high' }]);
  assert.equal(report.advisory_only, true);
  await assert.rejects(() => createShadowEnrichmentRepository({ reportPath: path }).read({ limit: 0 }), RangeError);
});
