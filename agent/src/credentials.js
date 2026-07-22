import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

function validate(value) {
  if (value?.version !== 1 || typeof value.agentId !== 'string' || !value.agentId || typeof value.token !== 'string' || value.token.length < 16) throw new Error('invalid agent credential file');
  if (value.endpoint !== undefined && !/^https?:\/\//.test(value.endpoint)) throw new Error('invalid agent credential endpoint');
  return value;
}

export async function readAgentCredential(path) {
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) throw new Error('agent credential file must be a regular owner-only file');
  return validate(JSON.parse(await readFile(path, 'utf8')));
}

export async function writeAgentCredential(path, credential) {
  const value = validate({ version: 1, ...credential });
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try { await file.writeFile(`${JSON.stringify(value)}\n`); await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, path);
}

export async function rotateAgentCredential(path, token, rotatedAt = new Date().toISOString()) {
  const current = await readAgentCredential(path);
  await writeAgentCredential(path, { ...current, token, rotatedAt });
  return { agentId: current.agentId, rotatedAt };
}
