export interface EventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
}

/** Event names use <bounded-context>.<entity>.<action>.v<major-version>. */
export const EventTypes = {
  userCreated: 'users.user.created.v1',
  projectCreated: 'project.created',
  projectDeleted: 'project.deleted',
  generationRequested: 'ai.generation.requested.v1',
  generationStarted: 'generation.started',
  generationCompleted: 'generation.completed',
  generationFailed: 'generation.failed',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
