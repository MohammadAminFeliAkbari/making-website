import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventTypes } from '../../../../libs/common/src/contracts/event.contract';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';
import { ProjectsService } from './projects.service';
import { ProjectBuildService } from './project-build.service';

@Injectable()
export class ProjectEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(ProjectEventsConsumer.name);
  constructor(private readonly config: ConfigService, private readonly events: EventBusService, private readonly projects: ProjectsService, private readonly build: ProjectBuildService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('RABBITMQ_CONSUMER_ENABLED', 'false') !== 'true') return;
    await this.events.subscribe('project-manager.events', async (event) => {
      if ([EventTypes.generationCompleted, EventTypes.generationFailed].includes(event.eventType as never)) {
        const payload = event.payload as { projectId?: string; userId?: string };
        await this.projects.handleGenerationEvent(event.eventType, payload);
        if (event.eventType === EventTypes.generationCompleted && payload.projectId && payload.userId) {
          await this.build.build(payload.userId, payload.projectId);
        }
        this.logger.log(`Observed ${event.eventType} (${event.eventId})`);
      }
    });
  }
}
