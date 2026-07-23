export const FEATURE_COLUMNS = [
  'event_count',
  'failed_login_count',
  'invalid_user_count',
  'successful_login_count',
  'distinct_user_count',
  'elevated_shell_count',
  'sensitive_file_access_count',
  'cron_modify_count'
];

const sigmoid = value => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))));
const number = value => Number(value ?? 0);
const target = row => row.is_malicious === true || row.is_malicious === 'true' || row.label === 'malicious' ? 1 : 0;

function vector(row, statistics) {
  return FEATURE_COLUMNS.map(feature => (number(row[feature]) - statistics[feature].mean) / statistics[feature].scale);
}

export function trainLogisticRegression(rows, { iterations = 1_500, learningRate = 0.12, l2 = 0.001 } = {}) {
  if (rows.length === 0) throw new Error('Cannot train without rows');
  if (new Set(rows.map(target)).size < 2) throw new Error('Training data must contain normal and malicious windows');
  const statistics = Object.fromEntries(FEATURE_COLUMNS.map(feature => {
    const values = rows.map(row => number(row[feature]));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return [feature, { mean, scale: Math.sqrt(variance) || 1 }];
  }));
  const inputs = rows.map(row => vector(row, statistics));
  const labels = rows.map(target);
  const weights = Array(FEATURE_COLUMNS.length).fill(0);
  let bias = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const gradient = Array(weights.length).fill(0);
    let biasGradient = 0;
    for (let index = 0; index < inputs.length; index += 1) {
      const prediction = sigmoid(bias + inputs[index].reduce((sum, value, feature) => sum + value * weights[feature], 0));
      const error = prediction - labels[index];
      biasGradient += error;
      for (let feature = 0; feature < weights.length; feature += 1) gradient[feature] += error * inputs[index][feature];
    }
    for (let feature = 0; feature < weights.length; feature += 1) weights[feature] -= learningRate * (gradient[feature] / inputs.length + l2 * weights[feature]);
    bias -= learningRate * biasGradient / inputs.length;
  }
  return { type: 'logistic_regression', feature_columns: FEATURE_COLUMNS, statistics, weights, bias, threshold: 0.5 };
}

export function predictProbability(model, row) {
  const values = vector(row, model.statistics);
  return sigmoid(model.bias + values.reduce((sum, value, index) => sum + value * model.weights[index], 0));
}

export function ruleBaselinePrediction(row) {
  return number(row.failed_login_count) >= 10 ? 1 : 0;
}

export function evaluate(rows, predictor) {
  let truePositive = 0, trueNegative = 0, falsePositive = 0, falseNegative = 0;
  for (const row of rows) {
    const actual = target(row);
    const predicted = predictor(row) ? 1 : 0;
    if (actual && predicted) truePositive += 1;
    else if (!actual && !predicted) trueNegative += 1;
    else if (!actual) falsePositive += 1;
    else falseNegative += 1;
  }
  const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive);
  const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative);
  return {
    evaluated_windows: rows.length,
    confusion_matrix: { true_positive: truePositive, true_negative: trueNegative, false_positive: falsePositive, false_negative: falseNegative },
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall),
    accuracy: rows.length === 0 ? 0 : (truePositive + trueNegative) / rows.length
  };
}

function evaluateProbabilities(rows, predictor) {
  const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const points = thresholds.map(threshold => ({
    threshold,
    ...evaluate(rows, row => predictor(row) >= threshold)
  }));
  const ranked = rows.map(row => ({ actual: target(row), probability: predictor(row) })).sort((left, right) => right.probability - left.probability);
  const positives = ranked.filter(row => row.actual).length;
  let truePositive = 0, falsePositive = 0, previousRecall = 0, averagePrecision = 0;
  for (const row of ranked) {
    if (row.actual) truePositive += 1;
    else falsePositive += 1;
    const recall = positives === 0 ? 0 : truePositive / positives;
    const precision = truePositive / (truePositive + falsePositive);
    averagePrecision += (recall - previousRecall) * precision;
    previousRecall = recall;
  }
  return { average_precision: averagePrecision, precision_recall_by_threshold: points };
}

export function evaluateBaselines(rows) {
  const trainingRows = rows.filter(row => row.split === 'train');
  const testRows = rows.filter(row => row.split === 'test');
  const model = trainLogisticRegression(trainingRows);
  return {
    model,
    report: {
      split: { training_windows: trainingRows.length, test_windows: testRows.length },
      model_feature_weights: Object.fromEntries(FEATURE_COLUMNS.map((feature, index) => [feature, model.weights[index]])),
      class_distribution: {
        training: { malicious: trainingRows.filter(target).length, normal: trainingRows.filter(row => !target(row)).length },
        test: { malicious: testRows.filter(target).length, normal: testRows.filter(row => !target(row)).length }
      },
      deterministic_rules_baseline: evaluate(testRows, ruleBaselinePrediction),
      logistic_regression_baseline: {
        ...evaluate(testRows, row => predictProbability(model, row) >= model.threshold),
        ...evaluateProbabilities(testRows, row => predictProbability(model, row))
      }
    }
  };
}
