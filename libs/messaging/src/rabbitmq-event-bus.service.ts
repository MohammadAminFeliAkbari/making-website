import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, ConfirmChannel, ChannelModel, ConsumeMessage } from 'amqplib';
import { EventEnvelope } from '../../common/src/contracts/event.contract';

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private readonly exchange = 'website-builder.events';

  constructor(private readonly config: ConfigService) {}

  async publish<T>(event: EventEnvelope<T>): Promise<void> {
    const channel = await this.getChannel();
    channel.publish(
      this.exchange,
      event.eventType,
      Buffer.from(JSON.stringify(event)),
      { contentType: 'application/json', persistent: true, messageId: event.eventId },
    );
    await channel.waitForConfirms();
    this.logger.log(`Published ${event.eventType} (${event.eventId})`);
  }

  async subscribe(
    queue: string,
    handler: (event: EventEnvelope, message: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, this.exchange, '#');
    await channel.prefetch(10);
    await channel.consume(queue, async (message) => {
      if (!message) return;
      try {
        await handler(JSON.parse(message.content.toString()) as EventEnvelope, message);
        channel.ack(message);
      } catch (error) {
        this.logger.error(`Failed to consume message from ${queue}`, error);
        channel.nack(message, false, false);
      }
    });
    this.logger.log(`Consuming RabbitMQ queue ${queue}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    const connection = await connect(
      this.config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672'),
    );
    this.connection = connection;
    const channel = await connection.createConfirmChannel();
    this.channel = channel;
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    return channel;
  }
}
