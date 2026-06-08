# Design: `@authgear/nestjs` (v1)

**Date:** 2026-06-08
**Status:** Approved

## Purpose

A NestJS SDK for **resource-server protection**: validate Authgear-issued
access tokens on incoming requests to a NestJS backend, and expose idiomatic
NestJS building blocks (a configurable module, an auth guard, and decorators)
to protect routes and read the authenticated user.

This is the integration requested in
[authgear/authgear-server#5745](https://github.com/authgear/authgear-server/issues/5745).
That request is a wishlist modeled on SuperTokens' NestJS integration; this
spec scopes v1 to the coherent authentication core and explicitly defers the
rest (see Non-Goals).

## Scope (v1)

Authentication only, using **JWT (offline) validation**:

1. `AuthgearModule.forRoot()` and `forRootAsync()`
2. `AuthgearAuthGuard` — verifies the bearer JWT against Authgear's JWKS
3. `@Public()` — whitelist routes when the guard is registered globally
4. `@CurrentUser()` — inject the validated, typed claims into a handler

### Validation strategy: JWT only

Authgear is configured to "Issue JWT as access token". The SDK fetches
Authgear's JWKS and verifies token signatures and claims **locally** — no
network call per request after warm-up. This requires the Authgear project to
have JWT access tokens enabled.

Opaque-token / userinfo online validation is **not** supported in v1.

## Non-Goals (deferred)

- **RBAC** (`@RequireRoles` / `@RequirePermissions`). Authgear's JWT access
  token does **not** carry roles/permissions by default
  ([reference](https://docs.authgear.com/reference/tokens/jwt-access-token));
  they can only be added via an Authgear JavaScript Hook. RBAC is deferred to
  a later version. When built, it should read from configurable claim paths
  and document the JS-Hook requirement, preserving offline validation.
- **Session refresh / revoke and `@AuthSession()`.** A JWT resource server has
  no server-side session; refresh/revoke require Authgear's Admin API or OAuth
  endpoints, which belong to a separate "management client" project. The
  "session" here *is* the token claims, covered by `@CurrentUser()`.
- **`@Protected()`.** Redundant: per-route protection is `@UseGuards(AuthgearAuthGuard)`;
  global registration plus `@Public()` covers the inverse.
- **Rate limiting, audit logging, per-user caching decorators.** Not
  auth-specific; covered by the NestJS ecosystem (`@nestjs/throttler`,
  interceptors).
- **Opaque/userinfo online validation.**

## Package & tooling

A standalone, publishable NestJS library in its own git repo.

- **Name:** `@authgear/nestjs`
- **Language/build:** TypeScript compiled with `tsc` to CommonJS + `.d.ts`.
  NestJS apps are CJS; this avoids dual-ESM complexity.
- **Runtime dependency:** `jose` (token verification).
- **Peer dependencies:** `@nestjs/common`, `@nestjs/core`, `reflect-metadata`,
  `rxjs` — never bundle the consumer's NestJS version.
- **Tests:** Jest + ts-jest (NestJS default).
- **Lint/format:** ESLint + Prettier (standard NestJS config).

## Module & configuration

`AuthgearModule` is a global-capable dynamic module exposing `forRoot(options)`
and `forRootAsync(asyncOptions)`. Async is required for `ConfigService`
injection.

```ts
interface AuthgearModuleOptions {
  endpoint: string;                // Authgear project endpoint, e.g. https://my.authgear.cloud
  clientID?: string;               // if set, also assert the `client_id` claim
  global?: boolean;                // register AuthgearAuthGuard as APP_GUARD (default false)
  jwksCacheMaxAge?: number;        // JWKS cache TTL (default handled by jose)
  clockToleranceSeconds?: number;  // leeway for exp/iat (default 0)
}
```

On initialization the module fetches Authgear's OIDC discovery document at
`{endpoint}/.well-known/openid-configuration` once to resolve `jwks_uri` and
`issuer`. This avoids hardcoding Authgear's URL layout and is robust to changes.
(Auto-discovery chosen over requiring an explicit JWKS URI.)

## Token verification (internal `AuthgearTokenService`)

Uses **`jose`**:

- `createRemoteJWKSet(jwks_uri)` provides JWKS fetching, in-memory caching, and
  key-rotation cooldown out of the box.
- `jwtVerify` performs per-request verification, offline after warm-up.

Checks performed:

- Signature against the JWKS
- `iss` === discovered issuer (the endpoint)
- `aud` contains the endpoint (per Authgear docs, access-token `aud` = project endpoint)
- `exp` / `iat` (with optional `clockToleranceSeconds`)
- `client_id` === configured `clientID` **only if** `clientID` was provided

Returns a typed `AuthgearClaims` object: `sub`, `iss`, `aud`, `isVerified`,
`isAnonymous`, `canReauthenticate`, plus the raw payload for custom claims.

## Guard & decorators (public API)

- **`AuthgearAuthGuard`** — extracts `Authorization: Bearer <jwt>`, calls the
  token service, attaches claims to `request.authgear`. Skips routes marked
  `@Public()` (read via `Reflector`). Missing/invalid token → `401 UnauthorizedException`.
- **`@Public()`** — metadata decorator to whitelist routes when the guard is global.
- **`@CurrentUser()`** — param decorator returning the typed `AuthgearClaims`,
  or a single field (e.g. `@CurrentUser('sub')`).

**Data flow:** request → guard verifies token → claims attached to request →
`@CurrentUser()` reads them in the handler.

## Error handling

- No/malformed `Authorization` header → `401`.
- Signature/claim/expiry failure → `401`. Never leak verification internals to
  the client; log details server-side.
- Discovery/JWKS fetch failure (startup or first request) → surfaced as a clear
  configuration error, not a silent `401`.

## Testing strategy

- Unit-test `AuthgearTokenService` by generating an in-memory key pair with
  `jose`, signing test tokens, and serving a fake JWKS. Cover: valid, expired,
  wrong-issuer, wrong-audience, bad-signature.
- Guard tests via mocked `ExecutionContext`: valid token, missing header,
  `@Public()` bypass, invalid token.
- An e2e test with a small NestJS test app (global guard + one public and one
  protected route).
