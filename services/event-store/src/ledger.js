export function createPostgresLedger(pool) {
  return {
    async claim(eventId, agentId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          'INSERT INTO ingested_event_ids (event_id, agent_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id',
          [eventId, agentId]
        );
        if (!result.rowCount) {
          await client.query('ROLLBACK');
          client.release();
          return { accepted: false };
        }
        return {
          accepted: true,
          async commit() { await client.query('COMMIT'); client.release(); },
          async rollback() { await client.query('ROLLBACK'); client.release(); }
        };
      } catch (error) {
        try { await client.query('ROLLBACK'); } finally { client.release(); }
        throw error;
      }
    }
  };
}
