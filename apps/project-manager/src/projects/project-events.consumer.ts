import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventTypes } from '../../../../libs/common/src/contracts/event.contract';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';
import { ProjectsService } from './projects.service';

@Injectable()
export class ProjectEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(ProjectEventsConsumer.name);
  constructor(private readonly config: ConfigService, private readonly events: EventBusService, private readonly projects: ProjectsService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('RABBITMQ_CONSUMER_ENABLED', 'false') !== 'true') return;
    await this.events.subscribe('project-manager.events', async (event) => {
      if ([EventTypes.generationCompleted, EventTypes.generationFailed].includes(event.eventType as never)) {
        await this.projects.handleGenerationEvent(event.eventType, event.payload as { projectId?: string });
        this.logger.log(`Observed ${event.eventType} (${event.eventId})`);
      }
    });
  }
}
