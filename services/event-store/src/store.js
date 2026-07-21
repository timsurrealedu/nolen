import { toSecurityEventRow } from './row.js';

export function createEventStore({ ledger, events }) {
  return {
    async persist(event, agentId) {
      const claim = await ledger.claim(event.id, agentId);
      if (!claim.accepted) return { stored: false, duplicate: true };
      try {
        await events.insert(toSecurityEventRow(event, agentId));
        await claim.commit();
        return { stored: true, duplicate: false };
      } catch (error) {
        await claim.rollback();
        throw error;
      }
    }
  };
}
