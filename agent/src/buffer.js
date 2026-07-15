import { appendFile, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

/** A durable JSONL queue. Entries stay present until the server acknowledges their IDs. */
export class EventBuffer {
  constructor(path) { this.path = path; }
  async enqueue(events) {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${events.map(JSON.stringify).join('\n')}\n`);
  }
  async pending() {
    try { return (await readFile(this.path, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  async acknowledge(ids) {
    const remove = new Set(ids);
    const remaining = (await this.pending()).filter(event => !remove.has(event.id));
    await writeFile(`${this.path}.next`, remaining.length ? `${remaining.map(JSON.stringify).join('\n')}\n` : '');
    await rename(`${this.path}.next`, this.path);
  }
}
