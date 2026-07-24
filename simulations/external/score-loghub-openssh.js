import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDataset } from '../dataset/generate.js';
import { buildFeatureTable } from '../ml/feature-table.js';
import { predictProbability, selectOperatingThreshold, trainLogisticRegression } from '../ml/baseline.js';
import { buildUnlabelledOpenSshFeatureRows } from './loghub-openssh.js';

const band = probability => probability >= 0.7 ? 'high' : probability >= 0.3 ? 'medium' : 'low';
const countBy = values => Object.fromEntries([...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));

export async function scoreLoghubOpenSsh({ eventsPath = new URL('../../data/processed/loghub-openssh/events.jsonl', import.meta.url), reportPath = new URL('../../data/processed/loghub-openssh/ml-shadow-report.json', import.meta.url) } = {}) {
  const events = (await readFile(eventsPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const trainingDataset = generateDataset();
  const trainingRows = buildFeatureTable(trainingDataset.events, trainingDataset.labels).rows.filter(row => row.split === 'train');
  const trainedModel = trainLogisticRegression(trainingRows);
  const threshold = selectOperatingThreshold(trainingRows, row => predictProbability(trainedModel, row)).threshold;
  const scores = buildUnlabelledOpenSshFeatureRows(events).map(row => ({ probability: predictProbability(trainedModel, row), row }));
  const report = {
    purpose: 'Advisory external score-distribution check; not an accuracy evaluation or incident mutation.',
    source_labels: 'none',
    model_training_data: 'Nolen synthetic dataset only',
    model_threshold: threshold,
    scored_window_count: scores.length,
    risk_band_distribution: countBy(scores.map(score => band(score.probability))),
    windows_at_or_above_threshold: scores.filter(score => score.probability >= threshold).length,
    score_range: scores.length ? { minimum: Math.min(...scores.map(score => score.probability)), maximum: Math.max(...scores.map(score => score.probability)) } : null,
    metrics_available: false,
    metric_blocker: 'LogHub OpenSSH has no reviewed external ground-truth labels.'
  };
  const destination = fileURLToPath(reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await scoreLoghubOpenSsh(), null, 2));
