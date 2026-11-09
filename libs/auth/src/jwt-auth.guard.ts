import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      const claims = await this.jwt.verifyAsync<AuthenticatedUser>(token);
      if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
        throw new UnauthorizedException();
      }
      (request as Request & { user?: AuthenticatedUser }).user = claims;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
