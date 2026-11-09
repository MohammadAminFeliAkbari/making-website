import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventTypes } from '../../../../libs/common/src/contracts/event.contract';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';

@Injectable()
export class UserEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(UserEventsConsumer.name);
  constructor(private readonly config: ConfigService, private readonly events: EventBusService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('RABBITMQ_CONSUMER_ENABLED', 'false') !== 'true') return;
    await this.events.subscribe('user-service.events', async (event) => {
      if (event.eventType === EventTypes.projectCreated) {
        this.logger.log(`Observed ${event.eventType} (${event.eventId})`);
      }
    });
  }
}
