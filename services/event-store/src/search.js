const fields = {
  category: 'category',
  action: 'action',
  hostId: 'host_id',
  user: 'user_name',
  sourceIp: 'source_ip',
  result: 'result'
};

const asClickHouseTimestamp = value => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new RangeError('start and end must be ISO-8601 timestamps');
  return date.toISOString().replace('T', ' ').replace('Z', '');
};

const boundedLimit = value => {
  const number = Number(value ?? 100);
  if (!Number.isInteger(number) || number < 1) throw new RangeError('limit must be a positive integer');
  return Math.min(number, 1_000);
};

export function buildEventSearchQuery(filters = {}) {
  const clauses = [], query_params = {};
  for (const [filter, column] of Object.entries(fields)) {
    if (!filters[filter]) continue;
    clauses.push(`${column} = {${filter}:String}`);
    query_params[filter] = filters[filter];
  }
  for (const [filter, operator] of [['start', '>='], ['end', '<=']]) {
    const timestamp = asClickHouseTimestamp(filters[filter]);
    if (!timestamp) continue;
    clauses.push(`event_timestamp ${operator} {${filter}:DateTime64(3, 'UTC')}`);
    query_params[filter] = timestamp;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return {
    query: `SELECT raw_nef FROM security_events FINAL ${where} ORDER BY event_timestamp DESC LIMIT ${boundedLimit(filters.limit)}`,
    query_params
  };
}

export function createClickHouseEventRepository(clickhouse) {
  return {
    async search(filters) {
      const result = await clickhouse.query({ ...buildEventSearchQuery(filters), format: 'JSONEachRow' });
      const rows = await result.json();
      return rows.map(row => JSON.parse(row.raw_nef));
    }
  };
}
