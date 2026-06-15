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

Obtain an access token by logging a user into your Authgear project. The token
must be a **JWT access token**, which requires "Issue JWT as access token" to be
enabled for the application in the Authgear portal. The easiest way to get one is
the browser frontend below.

## Browser frontend (`frontend/`)

`frontend/index.html` is a zero-build static page that logs in with the
[Authgear Web SDK](https://www.npmjs.com/package/@authgear/web) (loaded from a
CDN) and calls the protected `/me` route with the access token — the realistic
end-to-end flow. CORS is enabled in the example backend so the browser can call
the API.

1. In the Authgear portal, use a **Single Page Application** client and:
   - add `http://localhost:8080/` as a **Redirect URI** (exact match, including
     the trailing slash);
   - enable **Issue JWT as access token**.
2. Edit `frontend/index.html` and set `ENDPOINT` and `CLIENT_ID` to your project.
3. Serve it (any static server works):

   ```bash
   cd example/frontend
   python3 -m http.server 8080
   ```

4. Open http://localhost:8080, click **Log in**, then **Call /me** — you should
   see `200` with the verified token claims. **Call /health** works without
   logging in.
