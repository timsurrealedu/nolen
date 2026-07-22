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

test('restores an active sequence and incident suppression across restarts', async () => {
  let state;
  const stateStore = { load: async () => state, save: async value => { state = structuredClone(value); } };
  const events = sshCompromiseEvents(), published = [];
  const first = createDetectionProcessor({ stateStore, publishIncident: async incident => published.push(incident) });
  for (const event of events.slice(0, -1)) await first.process(event);

  const restarted = createDetectionProcessor({ stateStore, publishIncident: async incident => published.push(incident) });
  await restarted.restore();
  await restarted.process(events.at(-1));
  await restarted.process(events.at(-1));

  assert.equal(published.length, 1);
  assert.equal(state.events.length, events.length);
  assert.deepEqual(state.publishedIncidentIds, [published[0].id]);
});
