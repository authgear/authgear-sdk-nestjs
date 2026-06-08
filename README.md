# @authgear/nestjs

A NestJS SDK for protecting your API with [Authgear](https://www.authgear.com/).
It validates Authgear **JWT access tokens** offline (via JWKS) and provides a
module, an auth guard, and decorators.

> Requires "Issue JWT as access token" to be enabled for your Authgear
> application. Opaque tokens and RBAC are not supported in this version.

## Install

```bash
npm install @authgear/nestjs jose
```

## Setup

Register the module globally so the guard protects every route by default:

```ts
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

Async configuration (e.g. with `ConfigService`):

```ts
AuthgearModule.forRootAsync({
  global: true,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    endpoint: config.getOrThrow('AUTHGEAR_ENDPOINT'),
    clientID: config.get('AUTHGEAR_CLIENT_ID'),
  }),
});
```

## Usage

```ts
import { Controller, Get } from '@nestjs/common';
import { Public, CurrentUser, AuthgearClaims } from '@authgear/nestjs';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthgearClaims) {
    return { userId: user.sub };
  }
}
```

If you did not register the guard globally, protect routes per-handler:

```ts
import { UseGuards } from '@nestjs/common';
import { AuthgearAuthGuard } from '@authgear/nestjs';

@UseGuards(AuthgearAuthGuard)
@Get('me')
me() { /* ... */ }
```

## Options

| Option | Type | Description |
| --- | --- | --- |
| `endpoint` | `string` | Authgear project endpoint. Required. |
| `clientID` | `string` | If set, the verifier also asserts the token's `client_id` claim. |
| `global` | `boolean` | Register `AuthgearAuthGuard` as a global `APP_GUARD`. |
| `jwksCacheMaxAge` | `number` | JWKS cache max age (ms). |
| `clockToleranceSeconds` | `number` | Leeway for `exp`/`iat`. Default `0`. |
