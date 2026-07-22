import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NolenAgent } from '../src/client.js';
import { readAgentCredential, rotateAgentCredential, writeAgentCredential } from '../src/credentials.js';

test('writes and loads an owner-only agent credential without exposing its token', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nolen-credential-')), path = join(directory, 'agent.json');
  await writeAgentCredential(path, { agentId: 'agent-1', token: 'token-value-at-least-16', endpoint: 'https://ingest.example.test' });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await readAgentCredential(path)).agentId, 'agent-1');
  const agent = await NolenAgent.fromCredentialFile(path, { bufferPath: join(directory, 'queue.jsonl'), fetchImpl: async () => { throw new Error('unused'); } });
  assert.equal(agent.endpoint, 'https://ingest.example.test');
  assert.ok(!JSON.stringify(agent).includes('token-value-at-least-16'));
});

test('rejects permissive files and rotates atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nolen-rotation-')), path = join(directory, 'agent.json');
  await writeAgentCredential(path, { agentId: 'agent-1', token: 'old-token-at-least-16' });
  await chmod(path, 0o644);
  await assert.rejects(readAgentCredential(path), /owner-only/);
  await chmod(path, 0o600);
  assert.deepEqual(await rotateAgentCredential(path, 'new-token-at-least-16', '2026-07-22T01:00:00.000Z'), { agentId: 'agent-1', rotatedAt: '2026-07-22T01:00:00.000Z' });
  const stored = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(stored.token, 'new-token-at-least-16');
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});
