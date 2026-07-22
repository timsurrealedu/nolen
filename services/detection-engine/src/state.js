export function createPostgresDetectionState(pool, stateKey = 'detection-engine') {
  return {
    async load() {
      const result = await pool.query('SELECT state FROM detection_sequence_state WHERE state_key = $1', [stateKey]);
      return result.rows[0]?.state;
    },
    async save(state) {
      await pool.query(
        `INSERT INTO detection_sequence_state (state_key, state, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (state_key) DO UPDATE SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
        [stateKey, state]
      );
    }
  };
}
