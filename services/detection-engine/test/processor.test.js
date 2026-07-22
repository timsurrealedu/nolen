import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetectionProcessor } from '../src/processor.js';
import { sshCompromiseEvents } from '../../../simulations/ssh-compromise/fixture.js';

test('correlates individually delivered events and publishes an incident once', async () => {
  const published = [];
  const processor = createDetectionProcessor({ publishIncident: async incident => published.push(incident) });
  for (const event of sshCompromiseEvents()) await processor.process(event);
  await processor.process(sshCompromiseEvents().at(-1));
  assert.equal(published.length, 1);
  assert.equal(published[0].title, 'Probable SSH Account Compromise');
  assert.equal(published[0].evidenceEventIds.length, 12);
});

test('rejects malformed stream messages before changing detection state', async () => {
  const processor = createDetectionProcessor();
  await assert.rejects(processor.process({ id: 'bad', timestamp: 'invalid' }), /invalid detection event/);
});
