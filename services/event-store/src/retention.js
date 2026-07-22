export function buildRetentionPreviewQuery(days = 90) {
  if (!Number.isInteger(days) || days < 1 || days > 3_650) throw new RangeError('days must be an integer from 1 to 3650');
  return {
    query: `SELECT count() AS expiring_event_count, min(event_timestamp) AS oldest_event_timestamp, max(event_timestamp) AS newest_event_timestamp FROM security_events FINAL WHERE event_timestamp < now() - toIntervalDay({days:UInt16})`,
    query_params: { days }
  };
}

export function createRetentionPreview(clickhouse) {
  return {
    async preview(days) {
      const result = await clickhouse.query({ ...buildRetentionPreviewQuery(days), format: 'JSONEachRow' });
      const [summary] = await result.json();
      return { retention_days: days, mode: 'preview_only', ...summary };
    }
  };
}
