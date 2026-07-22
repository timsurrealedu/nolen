import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessDataQuality } from './data-quality.js';

const parseLabels = contents => {
  const [header, ...lines] = contents.trim().split(/\r?\n/);
  const columns = header.split(',');
  return lines.filter(Boolean).map(line => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
};

export async function validateDataFromFiles({ eventsPath = new URL('../dataset/out/events.jsonl', import.meta.url), labelsPath = new URL('../dataset/out/labels.csv', import.meta.url), reportPath = new URL('./out/data-quality-report.json', import.meta.url), now } = {}) {
  const [eventsContents, labelsContents] = await Promise.all([readFile(eventsPath, 'utf8'), readFile(labelsPath, 'utf8')]);
  const events = eventsContents.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const report = assessDataQuality(events, parseLabels(labelsContents), { now });
  const destination = fileURLToPath(reportPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await validateDataFromFiles(), null, 2));
