import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBaselines } from './baseline.js';

function parseCsv(contents) {
  const lines = contents.trim().split(/\r?\n/);
  const parseLine = line => {
    const values = [];
    let value = '', quoted = false;
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
  return lines.slice(1).filter(Boolean).map(line => Object.fromEntries(parseLine(line).map((value, index) => [columns[index], value])));
}

export async function evaluateFromFile({ inputPath = new URL('./out/feature-table.csv', import.meta.url), reportPath = new URL('./out/baseline-report.json', import.meta.url), modelPath = new URL('./out/logistic-regression-model.json', import.meta.url) } = {}) {
  const rows = parseCsv(await readFile(inputPath, 'utf8'));
  const { model, report } = evaluateBaselines(rows);
  await Promise.all([reportPath, modelPath].map(path => mkdir(dirname(fileURLToPath(path)), { recursive: true })));
  await Promise.all([
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(modelPath, `${JSON.stringify(model, null, 2)}\n`)
  ]);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await evaluateFromFile(), null, 2));
