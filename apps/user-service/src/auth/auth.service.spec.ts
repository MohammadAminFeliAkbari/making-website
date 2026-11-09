import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { EventBusService } from '../../../../libs/messaging/src/rabbitmq-event-bus.service';
import { PrismaService } from '../../../../libs/database/src/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'ad7eb327-2c4d-49dc-9b15-75817c26639f',
    email: 'person@example.com',
    passwordHash: '$2b$12$hash',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  };
  let service: AuthService;
  let prisma: { user: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> } };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let events: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { user: { create: vi.fn(), findUnique: vi.fn() } };
    jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt') };
    events = { publish: vi.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      events as unknown as EventBusService,
    );
  });

  it('hashes passwords, returns a safe user and publishes registration', async () => {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    prisma.user.create.mockResolvedValueOnce(safeUser);

    const result = await service.register({ email: ' PERSON@Example.com ', password: 'password123' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'person@example.com', passwordHash: expect.any(String) },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(await bcrypt.compare('password123', prisma.user.create.mock.calls[0][0].data.passwordHash)).toBe(true);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'user.registered', payload: { userId: user.id, email: user.email } }),
    );
  });

  it('maps duplicate email errors to a conflict', async () => {
    prisma.user.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.register({ email: user.email, password: 'password123' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('logs in with a valid password and publishes a safe event', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user);
    user.passwordHash = await bcrypt.hash('password123', 4);

    const result = await service.login({ email: ' PERSON@Example.com ', password: 'password123' });

    expect(result.accessToken).toBe('signed.jwt');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'user.logged_in', payload: { userId: user.id, email: user.email } }),
    );
  });

  it('uses the same unauthorized response for an unknown email and an incorrect password', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(user);
    user.passwordHash = await bcrypt.hash('correct-password', 4);
    await expect(service.login({ email: user.email, password: 'wrong-pass' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
