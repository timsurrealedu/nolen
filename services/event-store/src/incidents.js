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
    }
  };
}
