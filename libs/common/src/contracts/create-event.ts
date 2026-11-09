import { randomUUID } from 'node:crypto';
import { EventEnvelope } from './event.contract';

export function createEvent<TPayload>(
  eventType: string,
  payload: TPayload,
  correlationId = randomUUID(),
): EventEnvelope<TPayload> {
  return {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload,
  };
}
