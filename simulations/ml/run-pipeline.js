import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDataset } from '../dataset/generate.js';
import { buildFeatureTableFromFiles } from './build-feature-table.js';
import { evaluateFromFile } from './evaluate-baseline.js';
import { validateDataFromFiles } from './validate-data.js';
import { createShadowEnrichmentReport } from './shadow-enrichment.js';

export class MlInputBlockedError extends Error {
  constructor(report) {
    super(`ML pipeline stopped: ${report.summary.event_count} events failed critical data-quality checks.`);
    this.name = 'MlInputBlockedError';
    this.report = report;
  }
}

export function assertMlBuildAllowed(report) {
  if (report.summary.status === 'blocked') throw new MlInputBlockedError(report);
  return report;
}

export async function runMlPipeline() {
  const dataset = await writeDataset();
  const quality = assertMlBuildAllowed(await validateDataFromFiles());
  const featureTable = await buildFeatureTableFromFiles();
  const evaluation = await evaluateFromFile();
  const shadowEnrichment = await createShadowEnrichmentReport();
  return {
    dataset,
    data_quality: { status: quality.summary.status, findings: quality.findings },
    feature_table: featureTable,
    evaluation,
    shadow_enrichment: { advisory_only: shadowEnrichment.advisory_only, enrichment_count: shadowEnrichment.enrichment_count }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await runMlPipeline(), null, 2));
  } catch (error) {
    console.error(error.message);
    if (error.report) console.error(JSON.stringify(error.report.findings, null, 2));
    process.exitCode = 1;
  }
}
