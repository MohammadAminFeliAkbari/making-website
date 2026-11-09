import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../../libs/auth/src/authenticated-user';
import { CurrentUser } from '../../../../libs/auth/src/current-user.decorator';
import { JwtAuthGuard } from '../../../../libs/auth/src/jwt-auth.guard';
import { CreateProjectDto, GenerateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

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
}
