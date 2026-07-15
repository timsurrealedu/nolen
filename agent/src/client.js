import { EventBuffer } from './buffer.js';

export class NolenAgent {
  constructor({ endpoint, token, bufferPath, batchSize = 100, fetchImpl = fetch }) {
    this.endpoint = endpoint.replace(/\/$/, ''); this.token = token; this.buffer = new EventBuffer(bufferPath);
    this.batchSize = batchSize; this.fetch = fetchImpl;
  }
  async collect(events) { await this.buffer.enqueue(events); }
  async flush() {
    const events = await this.buffer.pending();
    for (let index = 0; index < events.length; index += this.batchSize) {
      const batch = events.slice(index, index + this.batchSize);
      let response;
      try {
        response = await this.fetch(`${this.endpoint}/v1/ingest/events`, { method: 'POST', headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ events: batch }) });
      } catch { return { delivered: index, retry: true }; }
      if (!response.ok) return { delivered: index, retry: response.status >= 500, status: response.status };
      const body = await response.json();
      await this.buffer.acknowledge(body.acceptedEventIds);
    }
    return { delivered: events.length, retry: false };
  }
}
