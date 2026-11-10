# Website Builder Backend

NestJS monorepo with separate user, project manager, and AI generation services. The user service provides password-based registration, login, JWT authentication, and profile retrieval.

## Local setup

Requirements: Node.js 20+, npm, and Docker Compose for PostgreSQL and RabbitMQ. Install and configure GapCode separately if you want the AI generation step.

```bash
cp .env.example .env
npm install
docker compose up -d postgres rabbitmq
npm run db:generate
npm run db:migrate:deploy
```

The Compose PostgreSQL container listens on host port `5000` (`5000:5432`). Set `DATABASE_URL` accordingly, for example:

```env
DATABASE_URL=postgresql://website_builder:website_builder@localhost:5000/website_builder
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=1h
USER_SERVICE_PORT=3001
CORS_ORIGINS=http://localhost:5173
WORKSPACES_ROOT=./workspaces
STARTER_TEMPLATE_PATH=./templates/sample-fronted
PREVIEW_BASE_URL=http://localhost
```

The Compose PostgreSQL host port is `5000`; RabbitMQ uses `5672`. Replace the development JWT secret in `.env`. Set `RABBITMQ_CONSUMER_ENABLED=true` to enable the project and generation event consumers. Ensure the `gapcode` executable is on `PATH` for AI generation.

Start each backend service in its own terminal from the repository root:

```bash
npm run start:user-service:dev
npm run start:project-manager:dev
npm run start:ai-generation:dev
```

Or run all three with `npm run start:all`. Start the Next.js frontend in another terminal:

```bash
cd front
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The frontend proxies API requests to the backend services at ports `3001`, `3002`, and `3003`. Swagger docs are available at `/api/docs` on each service.

For an existing project, you can test preview without GapCode: open its page and click **Install & run dev preview**. Project Manager installs npm dependencies, starts the project's `npm run dev` script on an available port from `4100–4199`, and returns the preview URL. The UI loads that URL in an iframe. Set `PREVIEW_BASE_URL` to a host reachable by the browser (use `http://localhost` for local testing).

For the full workflow, create a project in the frontend and submit a prompt. Project Manager publishes `generation.requested`; AI Generation runs GapCode in the workspace. On successful completion, Project Manager installs the generated project's dependencies and starts its development server. The frontend polls generation and project status and displays the preview when it is available. Keep RabbitMQ running and `RABBITMQ_CONSUMER_ENABLED=true` for this automatic event flow.

**Local preview mode runs generated npm lifecycle scripts directly on the backend host. Use only with trusted projects; it is intended for local testing, not untrusted production workloads.** The AI Generation service also needs `GAPCODE_BIN` (default `gapcode`) configured and authenticated in its environment.

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

Returns `200` with an access token and safe user profile. Invalid credentials return a generic `401` response.

### `GET /api/auth/me`

```bash
curl http://localhost:3001/api/auth/me \
  -H 'Authorization: Bearer <accessToken>'
```

Returns the authenticated user's `id`, `email`, `createdAt`, and `updatedAt`. Requests without a valid token return `401`.

Registration and successful login publish `user.registered` and `user.logged_in` RabbitMQ events using the shared event envelope. Event payloads contain only the user ID and normalized email.

Project preview endpoints (all require a bearer token and enforce project ownership) are `POST /api/projects/:projectId/build`, `/start`, `/stop`, `/restart`, and `GET /api/projects/:projectId/preview`, `/runtime`, `/logs`. Build installs dependencies and starts the local development server; the preview response provides the assigned URL and status.

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
