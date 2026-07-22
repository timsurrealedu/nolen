import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const source = new URL('../apps/console/public/', import.meta.url), output = new URL('../apps/console/dist/', import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all(['app.js', 'styles.css'].map(file => cp(new URL(file, source), new URL(file, output))));
const files = Object.fromEntries(await Promise.all(['app.js', 'styles.css'].map(async file => [file, createHash('sha256').update(await readFile(new URL(file, output))).digest('base64')])));
await writeFile(new URL('manifest.json', output), `${JSON.stringify({ builtAt: new Date().toISOString(), files }, null, 2)}\n`);
console.log('Production console assets built in apps/console/dist/.');
