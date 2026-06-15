# Authgear SDK for NestJS

[![@authgear/nestjs](https://img.shields.io/npm/v/@authgear/nestjs.svg?label=@authgear/nestjs)](https://www.npmjs.com/package/@authgear/nestjs)
[![@authgear/nestjs](https://img.shields.io/npm/dt/@authgear/nestjs.svg?label=@authgear/nestjs)](https://www.npmjs.com/package/@authgear/nestjs)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

With Authgear SDK for NestJS, you can protect your NestJS resource server (API) with [Authgear](https://www.authgear.com/) in just **a few lines of code**.
It validates Authgear **JWT access tokens** offline using OIDC discovery and JWKS — no network round-trip to Authgear on every request — and provides a NestJS module, an auth guard, and decorators for reading the authenticated user.

**Quick links** — 📚 [Documentation](https://authgear.github.io/authgear-sdk-nestjs/) · 🏁 [Getting Started](#getting-started) · 🗺️ [Roadmap](#roadmap) · 🛠️ [Troubleshooting](#troubleshooting) · 👥 [Contributing](#contributing)

## What is Authgear?

[Authgear](https://www.authgear.com/) is a highly adaptable identity-as-a-service (IDaaS) platform for web and mobile applications.
Authgear makes user authentication easier and faster to implement by integrating it into various types of applications — from single-page web apps to mobile applications to API services.

### Key Features

- Zero-trust authentication architecture with [OpenID Connect](https://openid.net/developers/how-connect-works/) (OIDC) standard.
- Easy-to-use interfaces for user registration and login, including email, phone, username as login ID, and password, OTP, magic links, etc.
- Support for a wide range of identity providers, such as [Google](https://developers.google.com/identity), [Apple](https://support.apple.com/en-gb/guide/deployment/depa64848f3a/web), and [Azure Active Directory](https://azure.microsoft.com/en-gb/products/active-directory/).
- Support for Passkeys, biometric login, and Multi-Factor Authentication (MFA) such as SMS/email-based verification and authenticator apps with TOTP.

This SDK focuses on the **resource server** side: verifying the JWT access tokens that Authgear issues, so your NestJS API can trust the caller's identity.

## Requirements

- **NestJS** >= 10 (works with NestJS 10 and 11)
- **Node.js** >= 18
- **"Issue JWT as access token" enabled** for your Authgear application — this SDK validates JWT access tokens offline and does not support opaque tokens.

## Installation

```sh
npm install @authgear/nestjs jose
```

## Getting Started

### 1. Enable JWT access tokens in Authgear

In the [Authgear Portal](https://portal.authgear.com/), open your application's settings and enable **"Issue JWT as access token"**. Without this, Authgear issues opaque access tokens, which this SDK cannot validate offline.

### 2. Register the module

Register `AuthgearModule.forRoot()` in your root module. Setting `global: true` registers `AuthgearAuthGuard` as a global guard so every route is protected by default.

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AuthgearModule } from '@authgear/nestjs';

@Module({
  imports: [
    AuthgearModule.forRoot({
      endpoint: 'https://my-project.authgear.cloud',
      global: true, // register AuthgearAuthGuard as a global guard
    }),
  ],
})
export class AppModule {}
```

Prefer to load configuration asynchronously (e.g. from `ConfigService`)? Use `forRootAsync()`:

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthgearModule } from '@authgear/nestjs';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthgearModule.forRootAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        endpoint: config.getOrThrow<string>('AUTHGEAR_ENDPOINT'),
        clientID: config.get<string>('AUTHGEAR_CLIENT_ID'),
      }),
    }),
  ],
})
export class AppModule {}
```

### 3. Protect your routes

When you register the module with `global: true`, every route requires a valid Bearer token by default. Use the `@Public()` decorator to opt a handler out of authentication:

```ts
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '@authgear/nestjs';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }
}
```

If you did **not** register the guard globally, protect individual routes (or controllers) with `@UseGuards(AuthgearAuthGuard)`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthgearAuthGuard } from '@authgear/nestjs';

@Controller('me')
@UseGuards(AuthgearAuthGuard)
export class MeController {
  @Get()
  me() {
    /* ... */
  }
}
```

### 4. Read the authenticated user

Use the `@CurrentUser()` parameter decorator to read the verified token claims in a protected handler:

```ts
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser, AuthgearClaims } from '@authgear/nestjs';

@Controller()
export class AppController {
  @Get('me')
  me(@CurrentUser() user: AuthgearClaims) {
    return {
      userId: user.sub,
      isVerified: user.isVerified,
    };
  }
}
```

`AuthgearClaims` exposes the common claims (`sub`, `iss`, `aud`, `clientID`, `isVerified`, `isAnonymous`, `canReauthenticate`) plus the full decoded JWT payload as `raw` for any custom claims.

## Usage

Callers must send the access token as a Bearer token:

```
Authorization: Bearer <jwt-access-token>
```

### Module options

`forRoot()` and the object returned by the `forRootAsync()` factory accept the following options:

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `endpoint` | `string` | ✓ | — | Authgear project endpoint, e.g. `https://my-project.authgear.cloud`. Used for OIDC discovery and JWKS. |
| `clientID` | `string` | | — | If set, the verifier also asserts the token's `client_id` claim equals this value. |
| `global` | `boolean` | | `false` | Register `AuthgearAuthGuard` as a global `APP_GUARD` so all routes are protected. (`forRoot`/`forRootAsync` option.) |
| `jwksCacheMaxAge` | `number` | | — | JWKS cache max age in milliseconds (passed through to `jose`). |
| `clockToleranceSeconds` | `number` | | `0` | Leeway in seconds applied to `exp`/`iat` checks. |

You can also inject `AuthgearTokenService` directly if you need to verify a token outside of the guard.

## Roadmap

Planned additions, all staying within the resource-server scope:

- **Role- and permission-based access control (RBAC).** `@RequireRoles()` and `@RequirePermissions()` decorators that authorize requests against roles/permissions read from configurable JWT claim paths (returning `403` on failure). Authgear's JWT access token does not carry roles or permissions by default, so this will rely on injecting them into the token via an [Authgear JavaScript Hook](https://docs.authgear.com/integration/add-custom-fields-to-a-jwt-access-token) — keeping validation fully offline.
- **Opaque (online) token validation.** An optional validation strategy that verifies access tokens via Authgear's introspection / UserInfo endpoint instead of offline JWKS. This removes the "Issue JWT as access token" requirement and supports **instant revocation**, at the cost of a network round-trip per request.
- **Machine-to-machine (M2M) token support.** First-class validation of the JWT access tokens Authgear issues to [M2M applications](https://docs.authgear.com/reference/tokens), plus a way to distinguish service callers from end users.
- **Step-up / recent-authentication checks.** A `@RequireRecentAuth(maxAgeSeconds)` decorator that enforces a maximum age on the token's `auth_time` claim, so sensitive routes can require the user to have authenticated recently.

This SDK is intentionally scoped to the **resource-server** (token-validation) role. Session lifecycle operations (refresh/revoke), the OAuth login flow, user management, and non-auth utilities (rate limiting, audit logging, per-user caching) are out of scope — use the relevant Authgear client SDK / Admin API and the standard NestJS ecosystem (`@nestjs/throttler`, interceptors) for those.

## Troubleshooting

**Every request returns `401 Unauthorized`.**

- Confirm **"Issue JWT as access token"** is enabled for the application in the Authgear Portal. Opaque tokens cannot be validated offline and will be rejected.
- Make sure the client sends the token in the `Authorization: Bearer <token>` header.
- If you set `clientID`, confirm the token's `client_id` claim matches it.
- If tokens are rejected due to clock skew between your server and Authgear, set `clockToleranceSeconds` to a small value.

**The application fails to start, or the first request errors with a discovery/JWKS error.**

- Check that `endpoint` is the correct Authgear project endpoint and is reachable from your server. The SDK fetches the OIDC discovery document and JWKS from this endpoint.

## Contributing

Contributions — documentation, features, bug fixes, tests, or code reviews — are very much welcome.

```sh
git clone git@github.com:authgear/authgear-sdk-nestjs.git
cd authgear-sdk-nestjs
npm install
npm test
npm run build
```

A runnable NestJS app demonstrating the SDK lives in [`example/`](./example). The documentation site source lives in [`docs/`](./docs) and is published to [https://authgear.github.io/authgear-sdk-nestjs/](https://authgear.github.io/authgear-sdk-nestjs/).

To join the community, raise your hand on the [Authgear Discord server](https://discord.gg/Kdn5vcYwAS) or the GitHub [discussions board](https://github.com/orgs/authgear/discussions).

## License

[Apache-2.0](./LICENSE)

## Supported and maintained by

<div align="center">
  <a href="https://github.com/authgear"><img src="https://uploads-ssl.webflow.com/60658b46b03f0cf83ac1485d/619e6607eb647619cecee2cf_authgear-logo.svg" /></a>
</div>

<p align="center">
  Authgear is a highly adaptable identity-as-a-service (IDaaS) platform for web and mobile applications. To learn more, visit <a href="https://www.authgear.com/">authgear.com</a>.
</p>
