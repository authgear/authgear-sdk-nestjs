# @authgear/nestjs example app

A minimal NestJS app for testing the `@authgear/nestjs` SDK end-to-end against a
real Authgear project. It is wired as an npm workspace, so it consumes the SDK
from this repo (no npm publish needed).

## Routes

| Method | Path      | Auth        | Description                              |
| ------ | --------- | ----------- | ---------------------------------------- |
| GET    | `/health` | Public      | Health check (`@Public()`, no token)     |
| GET    | `/me`     | Protected   | Returns claims from the verified token   |

The guard is registered globally (`global: true`), so every route requires a
valid bearer token except those marked `@Public()`.

## Setup

From the **repo root** (installs all workspaces and builds the SDK):

```bash
npm install
npm run build        # compiles the SDK to dist/ (the example imports this)
```

Then configure and run the example:

```bash
cd example
cp .env.example .env
# edit .env and set AUTHGEAR_ENDPOINT to your Authgear project endpoint
npm run start:dev
```

The app listens on http://localhost:3000.

> If you change the SDK source, re-run `npm run build` at the repo root to
> refresh `dist/`, then restart the example.

## Try it

Public route — works without a token:

```bash
curl -i http://localhost:3000/health
# 200 {"status":"ok"}
```

Protected route — rejected without a token:

```bash
curl -i http://localhost:3000/me
# 401 Unauthorized
```

Protected route — with a valid Authgear access token (JWT):

```bash
curl -i http://localhost:3000/me \
  -H "Authorization: Bearer <YOUR_AUTHGEAR_ACCESS_TOKEN>"
# 200 {"sub":"...","isVerified":true,...}
```

Obtain an access token by logging a user into your Authgear project (e.g. via a
frontend SDK or the Authgear test client). The token must be a **JWT access
token**, which requires "Issue JWT as access token" to be enabled for the
application in the Authgear portal.
