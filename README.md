# Website Builder Backend

NestJS monorepo with separate user, project manager, and AI generation services. The user service provides password-based registration, login, JWT authentication, and profile retrieval.

## Local setup

```bash
npm install
docker compose up -d postgres rabbitmq
npm run db:generate
npm run db:migrate
npm run start:user-service:dev
```

The Compose PostgreSQL container listens on host port `5000` (`5000:5432`). Set `DATABASE_URL` accordingly, for example:

```env
DATABASE_URL=postgresql://website_builder:website_builder@localhost:5000/website_builder
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=1h
USER_SERVICE_PORT=3001
CORS_ORIGINS=http://localhost:5173
```

Copy `.env.example` to `.env` and replace the development JWT secret. RabbitMQ is available at `localhost:5672`. `npm run start:all` starts all three services; the user service requires PostgreSQL, and features that publish events require RabbitMQ.

## Authentication API

All routes use the global `/api` prefix.

### `POST /api/auth/register`

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"person@example.com","password":"correct-horse-battery"}'
```

Returns `201` with an `accessToken` and safe `user` profile. Email is trimmed and lowercased. Passwords must be at least 8 characters. Duplicate email addresses return `409`.

### `POST /api/auth/login`

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"person@example.com","password":"correct-horse-battery"}'
```

Returns `201` with an access token and safe user profile. Invalid credentials return a generic `401` response.

### `GET /api/auth/me`

```bash
curl http://localhost:3001/api/auth/me \
  -H 'Authorization: Bearer <accessToken>'
```

Returns the authenticated user's `id`, `email`, `createdAt`, and `updatedAt`. Requests without a valid token return `401`.

Registration and successful login publish `user.registered` and `user.logged_in` RabbitMQ events using the shared event envelope. Event payloads contain only the user ID and normalized email.

## Database and checks

Prisma schema and SQL migrations are in `prisma/`.

```bash
npm run db:generate
npm run db:migrate       # local development migration
npm run db:migrate:deploy # apply committed migrations in deployment
npm test
npm run test:e2e
npm run typecheck
```
