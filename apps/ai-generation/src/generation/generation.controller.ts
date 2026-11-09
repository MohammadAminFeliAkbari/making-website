import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../../libs/auth/src/authenticated-user';
import { CurrentUser } from '../../../../libs/auth/src/current-user.decorator';
import { JwtAuthGuard } from '../../../../libs/auth/src/jwt-auth.guard';
import { GenerationService } from './generation.service';

@ApiTags('Generations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('generations')
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('projectId') projectId?: string, @Query('skip') skip = '0', @Query('take') take = '20') {
    return this.generation.list(user.sub, projectId, Math.max(0, Number(skip) || 0), Math.min(100, Math.max(1, Number(take) || 20)));
  }

  @Get(':generationId')
  get(@CurrentUser() user: AuthenticatedUser, @Param('generationId', ParseUUIDPipe) id: string) {
    return this.generation.get(user.sub, id);
  }
}
