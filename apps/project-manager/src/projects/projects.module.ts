import { Module } from '@nestjs/common';
import { AuthModule } from '../../../../libs/auth/src/auth.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectEventsConsumer } from './project-events.consumer';
import { ProjectBuildService } from './project-build.service';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectEventsConsumer, ProjectBuildService],
})
export class ProjectsModule {}
