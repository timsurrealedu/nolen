import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_COLUMNS, predictProbability } from './baseline.js';

const parseCsv = contents => {
  const lines = contents.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const parseLine = line => {
    const values = []; let value = '', quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) { values.push(value); value = ''; }
      else value += character;
    }
    values.push(value);
    return values;
  };
  const columns = parseLine(lines[0]);
  return lines.slice(1).map(line => Object.fromEntries(parseLine(line).map((value, index) => [columns[index], value])));
};

const riskBand = probability => probability >= 0.8 ? 'high' : probability >= 0.5 ? 'medium' : 'low';

function assertScorable(model, row) {
  if (!model || model.type !== 'logistic_regression') throw new Error('Shadow enrichment requires a logistic-regression model.');
  if (!row?.window_start || !row?.host_id || !row?.source_ip) throw new Error('Shadow enrichment requires a canonical ML entity and five-minute window.');
  for (const feature of FEATURE_COLUMNS) if (!Number.isFinite(Number(row[feature]))) throw new Error(`Shadow enrichment requires numeric ${feature}.`);
}

export function createShadowEnrichment(model, row, { modelVersion = 'ml-baseline-v1', dataQualityStatus = 'ready_for_offline_ml' } = {}) {
  assertScorable(model, row);
  const probability = predictProbability(model, row);
  const top_features = FEATURE_COLUMNS.map((feature, index) => {
    const statistics = model.statistics[feature];
    const standardized_value = (Number(row[feature]) - statistics.mean) / statistics.scale;
    return { feature, raw_value: Number(row[feature]), contribution: standardized_value * model.weights[index] };
  }).sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution)).slice(0, 3);
  return {
    enrichment_type: 'ml_advisory_shadow',
    advisory_only: true,
    policy: 'This enrichment cannot create, suppress, close, reprioritize, or modify deterministic incidents.',
    model_version: modelVersion,
    data_quality_status: dataQualityStatus,
    entity: { entity_type: row.entity_type, host_id: row.host_id, source_ip: row.source_ip, user_name: row.user_name || null },
    window_start: row.window_start,
    probability,
    risk_band: riskBand(probability),
    top_features
  };
}

export async function createShadowEnrichmentReport({ featureTablePath = new URL('./out/feature-table.csv', import.meta.url), modelPath = new URL('./out/logistic-regression-model.json', import.meta.url), qualityPath = new URL('./out/data-quality-report.json', import.meta.url), outputPath = new URL('./out/shadow-enrichment-report.json', import.meta.url) } = {}) {
  const [rowsContents, modelContents, qualityContents] = await Promise.all([readFile(featureTablePath, 'utf8'), readFile(modelPath, 'utf8'), readFile(qualityPath, 'utf8')]);
  const rows = parseCsv(rowsContents);
  const model = JSON.parse(modelContents);
  const quality = JSON.parse(qualityContents);
  if (quality.summary.status === 'blocked') throw new Error('Shadow enrichment is blocked by critical ML data-quality findings.');
  const enrichments = rows.map(row => createShadowEnrichment(model, row, { dataQualityStatus: quality.summary.status }));
  const report = {
    report_type: 'ml_advisory_shadow_enrichment',
    advisory_only: true,
    model_version: 'ml-baseline-v1',
    data_quality_status: quality.summary.status,
    enrichment_count: enrichments.length,
    enrichments
  };
  const destination = fileURLToPath(outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await createShadowEnrichmentReport(), null, 2));
