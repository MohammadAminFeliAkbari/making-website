# Forma Frontend

Next.js App Router frontend for the Website Builder backend. API clients live in `lib/api.ts`; Next rewrites proxy browser requests to the three backend services, avoiding cross-origin browser requests.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The backend services should be running on ports 3001, 3002, and 3003 with RabbitMQ consumption enabled for generation jobs. Override `USER_SERVICE_URL`, `PROJECT_MANAGER_URL`, and `AI_GENERATION_URL` in `.env.local` if the services run elsewhere.

## Authentication and API flow

The User Service returns a JWT in its JSON response and does not set a secure cookie. The frontend keeps it in `sessionStorage` for the current browser tab, attaches it as a bearer token, and clears it on 401/logout. Calls are proxied to `/api/auth/*`, `/api/projects/*`, and `/api/generations/*` through `next.config.ts`.

The UI uses the implemented endpoints: auth register/login/me; project list/create/get/generate; and generation list/get. Generation status is polled while jobs are queued or running. API errors are shown in the page.

## Known backend limitations

- No service currently exposes generated workspace files as a preview URL or serves them over HTTP. Project pages explain this and show the workspace folder instead of presenting a fake preview.
- Project Manager accepts a project name and generation prompt; website-type selection is not supported by its API.
- The backend has no cookie-based JWT flow, so this frontend uses session-scoped browser storage rather than an HttpOnly cookie.

## Checks

```bash
npm run typecheck
npm run build
```

No frontend test runner was part of the repository, and this frontend does not add mocked API responses.
