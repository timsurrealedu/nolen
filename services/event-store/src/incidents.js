export function createPostgresIncidentRepository(pool) {
  return {
    async persist(incident) {
      const result = await pool.query(
        `INSERT INTO incidents (incident_id, created_at, severity, status, body)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING incident_id`,
        [incident.id, incident.createdAt, incident.severity, incident.status, incident]
      );
      return { stored: result.rowCount === 1, duplicate: result.rowCount === 0 };
    },
    async list({ limit = 100 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError('limit must be between 1 and 1000');
      const result = await pool.query('SELECT body FROM incidents ORDER BY created_at DESC, incident_id LIMIT $1', [limit]);
      return result.rows.map(row => row.body);
    },
    async updateStatus(id, status, changedBy) {
      const result = await pool.query(
        `WITH previous AS (
           SELECT incident_id, status FROM incidents WHERE incident_id = $1 FOR UPDATE
         ), updated AS (
           UPDATE incidents SET status = $2, body = jsonb_set(body, '{status}', to_jsonb($2::text))
           WHERE incident_id = $1 RETURNING body
         ), audited AS (
           INSERT INTO incident_status_audit (incident_id, previous_status, new_status, changed_by)
           SELECT incident_id, status, $2, $3 FROM previous WHERE status <> $2
         ) SELECT body, (SELECT status FROM previous) AS previous_status FROM updated`,
        [id, status, changedBy]
      );
      return result.rows[0] && { ...result.rows[0].body, previousStatus: result.rows[0].previous_status };
    }
  };
}
