import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module';
import { EventBusService } from '../../../libs/messaging/src/rabbitmq-event-bus.service';
import { PrismaService } from '../../../libs/database/src/prisma.service';

describe('User auth endpoints (integration)', () => {
  let app: INestApplication<App>;
  const users: Array<{
    id: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const prismaMock = {
    user: {
      create: vi.fn(async ({ data }: { data: { email: string; passwordHash: string } }) => {
        if (users.some((user) => user.email === data.email)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        const now = new Date();
        const user = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
        users.push(user);
        const { passwordHash: _passwordHash, ...safeUser } = user;
        return safeUser;
      }),
      findUnique: vi.fn(async ({ where, select }: { where: { email?: string; id?: string }; select?: object }) => {
        const user = users.find((candidate) => (where.email ? candidate.email === where.email : candidate.id === where.id));
        if (!user) return null;
        if (select) {
          const safeUser = { id: user.id, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt };
          return safeUser;
        }
        return user;
      }),
    },
  };
  const eventsMock = { publish: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn() };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-test-secret-that-is-not-used-outside-tests';
    process.env.RABBITMQ_CONSUMER_ENABLED = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(EventBusService)
      .useValue(eventsMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors({ origin: ['http://localhost:5173'], credentials: true });
    await app.init();
  });

  beforeEach(() => {
    users.splice(0);
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and returns a token and safe profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: ' Person@Example.com ', password: 'password123' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('person@example.com');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(users[0].passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', users[0].passwordHash)).toBe(true);
  });

  it('rejects duplicate email registration', async () => {
    const body = { email: 'person@example.com', password: 'password123' };
    await request(app.getHttpServer()).post('/api/auth/register').send(body).expect(201);
    await request(app.getHttpServer()).post('/api/auth/register').send(body).expect(409);
  });

  it('logs in with a valid password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'person@example.com', password: 'password123' });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'PERSON@example.com', password: 'password123' })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an incorrect password with a generic unauthorized response', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'person@example.com', password: 'password123' });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'person@example.com', password: 'wrongpass' })
      .expect(401, { message: 'Invalid email or password', error: 'Unauthorized', statusCode: 401 });
  });

  it('rejects invalid email input', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' })
      .expect(400);
  });

  it('rejects access to the profile without a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('returns the authenticated user profile for a valid token', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'person@example.com', password: 'password123' });

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .expect(200);

    expect(response.body.email).toBe('person@example.com');
    expect(response.body).not.toHaveProperty('passwordHash');
  });
});
