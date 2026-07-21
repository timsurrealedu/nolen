import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDataset } from '../dataset/generate.js';
import { evaluate, predictProbability, ruleBaselinePrediction, trainLogisticRegression } from './baseline.js';
import { generateChallengeDataset } from './challenge-dataset.js';
import { buildFeatureTable } from './feature-table.js';

export async function evaluateChallenge({ reportPath = new URL('./out/challenge-report.json', import.meta.url) } = {}) {
  const trainingDataset = generateDataset();
  const training = buildFeatureTable(trainingDataset.events, trainingDataset.labels).rows.filter(row => row.split === 'train');
  const challengeDataset = generateChallengeDataset();
  const challenge = buildFeatureTable(challengeDataset.events, challengeDataset.labels, { timeCutoff: '1900-01-01' }).rows;
  const model = trainLogisticRegression(training);
  const report = {
    purpose: 'Out-of-distribution challenge only; do not use these rows for training.',
    training_windows: training.length,
    challenge_windows: challenge.length,
    deterministic_rules_baseline: evaluate(challenge, ruleBaselinePrediction),
    logistic_regression_baseline: evaluate(challenge, row => predictProbability(model, row) >= model.threshold)
  };
  const destination = fileURLToPath(reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await evaluateChallenge(), null, 2));
