import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationEventsConsumer } from './generation-events.consumer';
import { AuthModule } from '../../../../libs/auth/src/auth.module';

@Module({
  controllers: [GenerationController],
  imports: [AuthModule],
  providers: [GenerationService, GenerationEventsConsumer],
})
export class GenerationModule {}
