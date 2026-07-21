import { startEventStore } from './consumer.js';

await startEventStore();
console.log('Nolen event store is consuming events.raw');
