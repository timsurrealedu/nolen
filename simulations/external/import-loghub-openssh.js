import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importLoghubOpenSsh } from './loghub-openssh.js';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await importLoghubOpenSsh({ year: Number(process.env.LOGHUB_START_YEAR) });
  console.log(JSON.stringify(report, null, 2));
}
