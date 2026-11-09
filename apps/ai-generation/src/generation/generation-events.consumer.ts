import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventTypes } from '../../../../libs/common/src/contracts/event.contract';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';
import { GenerationService } from './generation.service';

@Injectable()
export class GenerationEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(GenerationEventsConsumer.name);
  constructor(private readonly config: ConfigService, private readonly events: EventBusService, private readonly generation: GenerationService) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('RABBITMQ_CONSUMER_ENABLED', 'false') !== 'true') return;
    await this.events.subscribe('ai-generation.events', async (event) => {
      if (event.eventType === EventTypes.generationRequested) {
        await this.generation.receive(event.payload as never);
        this.logger.log(`Received ${event.eventType} (${event.eventId})`);
      }
    });
  }
}
