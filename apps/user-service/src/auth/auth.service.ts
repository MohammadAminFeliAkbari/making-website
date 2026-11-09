import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../../../../libs/auth/src/authenticated-user';
import { createEvent } from '../../../../libs/common/src/contracts/create-event';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';
import { PrismaService } from '../../../../libs/database/src/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

export type SafeUser = {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventBusService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    let user: SafeUser;
    try {
      user = await this.prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }

    await this.events.publish(
      createEvent('user.registered', { userId: user.id, email: user.email }),
    );
    return { accessToken: await this.signToken(user), user };
  }

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    await this.events.publish(
      createEvent('user.logged_in', { userId: user.id, email: user.email }),
    );
    return { accessToken: await this.signToken(safeUser), user: safeUser };
  }

  async me(authenticated: AuthenticatedUser): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: authenticated.sub },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private signToken(user: Pick<SafeUser, 'id' | 'email'>): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, email: user.email, jti: randomUUID() });
  }
}
