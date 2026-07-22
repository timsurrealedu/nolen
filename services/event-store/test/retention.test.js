import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetentionPreviewQuery, createRetentionPreview } from '../src/retention.js';

test('builds a bounded, non-destructive retention preview query', async () => {
  assert.equal(buildRetentionPreviewQuery(90).query_params.days, 90);
  assert.throws(() => buildRetentionPreviewQuery(0), RangeError);
  let request;
  const preview = createRetentionPreview({ query: async options => { request = options; return { json: async () => [{ expiring_event_count: '12', oldest_event_timestamp: '2025-01-01 00:00:00', newest_event_timestamp: '2025-04-01 00:00:00' }] }; } });
  const result = await preview.preview(30);
  assert.equal(result.mode, 'preview_only');
  assert.equal(request.query_params.days, 30);
});
