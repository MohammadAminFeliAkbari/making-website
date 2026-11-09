import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../../../libs/auth/src/current-user.decorator';
import { AuthenticatedUser } from '../../../../libs/auth/src/authenticated-user';
import { JwtAuthGuard } from '../../../../libs/auth/src/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a user' })
  @ApiCreatedResponse({ description: 'Account created; returns a JWT and safe user profile.' })
  @ApiConflictResponse({ description: 'An account with this email already exists.' })
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in' })
  @ApiOkResponse({ description: 'Returns a JWT and safe user profile.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Safe profile for the current user.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }
}
