import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../../libs/auth/src/authenticated-user';
import { CurrentUser } from '../../../../libs/auth/src/current-user.decorator';
import { JwtAuthGuard } from '../../../../libs/auth/src/jwt-auth.guard';
import { CreateProjectDto, GenerateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';
import { ProjectBuildService } from './project-build.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService, private readonly build: ProjectBuildService) {}

  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.sub, dto.name);
  }

  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.list(user.sub);
  }

  @Get(':projectId') get(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.projects.get(user.sub, id);
  }

  @Delete(':projectId') delete(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.projects.delete(user.sub, id);
  }

  @Post(':projectId/generations') generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) id: string,
    @Body() dto: GenerateProjectDto,
  ) {
    return this.projects.generate(user.sub, id, dto.prompt);
  }

  @Post(':projectId/build') buildProject(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) {
    return this.build.build(user.sub, id);
  }
  @Post(':projectId/start') start(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) { return this.build.start(user.sub, id); }
  @Post(':projectId/stop') stop(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) { return this.build.stop(user.sub, id); }
  @Post(':projectId/restart') restart(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) { return this.build.restart(user.sub, id); }
  @Get(':projectId/preview') preview(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) { return this.build.preview(user.sub, id); }
  @Get(':projectId/runtime') runtime(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) { return this.build.runtime(user.sub, id); }
  @Get(':projectId/logs') logs(@CurrentUser() user: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) id: string) { return this.build.logs(user.sub, id); }
}
