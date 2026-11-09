import { Module } from '@nestjs/common';
import { UserEventsConsumer } from './user-events.consumer';

@Module({ providers: [UserEventsConsumer] })
export class UsersModule {}
