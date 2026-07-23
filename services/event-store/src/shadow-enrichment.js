import { readFile } from 'node:fs/promises';

export function createShadowEnrichmentRepository({ reportPath = new URL('../../../simulations/ml/out/shadow-enrichment-report.json', import.meta.url) } = {}) {
  return {
    async read({ limit = 50 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new RangeError('limit must be an integer from 1 to 1000');
      const report = JSON.parse(await readFile(reportPath, 'utf8'));
      if (report.report_type !== 'ml_advisory_shadow_enrichment' || report.advisory_only !== true || !Array.isArray(report.enrichments)) throw new Error('invalid shadow enrichment report');
      return {
        report_type: report.report_type,
        advisory_only: true,
        model_version: report.model_version,
        data_quality_status: report.data_quality_status,
        enrichment_count: report.enrichment_count,
        enrichments: report.enrichments.slice(0, limit)
      };
    }
  };
}
