import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../libs/auth/src/auth.module';
import { DatabaseModule } from '../../../libs/database/src/database.module';
import { MessagingModule } from '../../../libs/messaging/src/messaging.module';
import { GenerationModule } from './generation/generation.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    MessagingModule,
    HealthModule,
    GenerationModule,
  ],
})
export class AppModule {}
