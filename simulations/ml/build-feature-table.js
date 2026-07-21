import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFeatureTable, toCsv } from './feature-table.js';

const parseLabels = contents => {
  const [header, ...lines] = contents.trim().split(/\r?\n/);
  const columns = header.split(',');
  return lines.filter(Boolean).map(line => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
};

export async function buildFeatureTableFromFiles({ eventsPath = new URL('../dataset/out/events.jsonl', import.meta.url), labelsPath = new URL('../dataset/out/labels.csv', import.meta.url), outputPath = new URL('./out/feature-table.csv', import.meta.url) } = {}) {
  const [eventsContents, labelsContents] = await Promise.all([readFile(eventsPath, 'utf8'), readFile(labelsPath, 'utf8')]);
  const events = eventsContents.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const labels = parseLabels(labelsContents);
  const result = buildFeatureTable(events, labels);
  const destination = fileURLToPath(outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, toCsv(result.rows));
  return result.metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildFeatureTableFromFiles(), null, 2));
