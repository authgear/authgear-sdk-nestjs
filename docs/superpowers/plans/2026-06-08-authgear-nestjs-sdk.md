# @authgear/nestjs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@authgear/nestjs`, a NestJS resource-server SDK that validates Authgear JWT access tokens offline and exposes an `AuthgearModule`, an `AuthgearAuthGuard`, and `@Public()` / `@CurrentUser()` decorators.

**Architecture:** A dynamic NestJS module configures an internal `AuthgearTokenService` that performs OIDC discovery against the Authgear endpoint and verifies bearer JWTs against the project's JWKS using `jose` (cached, offline after warm-up). A guard runs verification per request, honors `@Public()`, and attaches typed claims to the request for `@CurrentUser()` to read.

**Tech Stack:** TypeScript (CommonJS via `tsc`), NestJS (`@nestjs/common`, `@nestjs/core` as peers), `jose` for JWT/JWKS, Jest + ts-jest + supertest for tests.

---

## File Structure

```
package.json                         # package manifest, scripts, deps
tsconfig.json                        # base TS config (used by jest/editor)
tsconfig.build.json                  # build config (emits dist/, excludes tests)
jest.config.js                       # jest + ts-jest config
.eslintrc.js                         # lint config
.prettierrc                          # format config
.gitignore                           # ignore node_modules/, dist/
README.md                            # usage docs
src/
  index.ts                           # public barrel exports
  authgear.constants.ts              # injection token + metadata keys
  authgear.interfaces.ts             # AuthgearModuleOptions, async options, AuthgearClaims
  authgear-token.service.ts          # OIDC discovery + jose verification
  authgear-auth.guard.ts             # AuthgearAuthGuard (CanActivate)
  authgear.module.ts                 # AuthgearModule.forRoot / forRootAsync
  decorators/
    public.decorator.ts              # @Public()
    current-user.decorator.ts        # @CurrentUser()
test/
  test-tokens.ts                     # shared helper: key pair, JWKS, fetch mock, token signer
  authgear-token.service.spec.ts     # unit tests for token service
  public.decorator.spec.ts           # unit test for @Public()
  current-user.decorator.spec.ts     # unit test for @CurrentUser() factory
  authgear-auth.guard.spec.ts        # unit tests for the guard
  app.e2e-spec.ts                    # end-to-end test with a small Nest app
```

**Responsibilities:** Each `src` file has one job. `authgear-token.service.ts` owns all network + crypto; the guard owns request plumbing only; decorators are metadata/extraction shims; the module wires providers. Files that change together (a unit and its test) sit in mirrored locations.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.js`, `.eslintrc.js`, `.prettierrc`, `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@authgear/nestjs",
  "version": "0.1.0",
  "description": "Authgear SDK for NestJS — validate Authgear JWT access tokens and protect routes.",
  "license": "Apache-2.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "format": "prettier --write \"{src,test}/**/*.ts\""
  },
  "dependencies": {
    "jose": "^5.9.6"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0 || ^11.0.0",
    "@nestjs/core": "^10.0.0 || ^11.0.0",
    "reflect-metadata": "^0.1.13 || ^0.2.0",
    "rxjs": "^7.0.0"
  },
  "devDependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "jest": "^29.7.0",
    "prettier": "^3.3.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.5",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["test", "**/*.spec.ts", "**/*.e2e-spec.ts", "dist"]
}
```

- [ ] **Step 4: Create `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.(spec|e2e-spec)\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
};
```

- [ ] **Step 5: Create `.eslintrc.js`**

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  root: true,
  env: { node: true, jest: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
```

- [ ] **Step 6: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
dist/
coverage/
*.log
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Verify the toolchain runs**

Run: `npx tsc -p tsconfig.build.json --noEmit && npx jest --passWithNoTests`
Expected: tsc prints nothing (no source files yet is fine because `include: ["src"]` matches nothing — exit 0), jest prints "No tests found ... passWithNoTests" and exits 0.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json tsconfig.build.json jest.config.js .eslintrc.js .prettierrc .gitignore package-lock.json
git commit -m "chore: scaffold @authgear/nestjs project"
```

---

## Task 2: Constants and interfaces

**Files:**
- Create: `src/authgear.constants.ts`
- Create: `src/authgear.interfaces.ts`

- [ ] **Step 1: Create `src/authgear.constants.ts`**

```ts
/** DI token holding the resolved runtime options (AuthgearModuleOptions). */
export const AUTHGEAR_MODULE_OPTIONS = 'AUTHGEAR_MODULE_OPTIONS';

/** Reflector metadata key set by @Public(). */
export const IS_PUBLIC_KEY = 'authgear:isPublic';

/** Property name under which verified claims are attached to the request. */
export const AUTHGEAR_REQUEST_PROPERTY = 'authgear';
```

- [ ] **Step 2: Create `src/authgear.interfaces.ts`**

```ts
import type { ModuleMetadata } from '@nestjs/common';
import type { JWTPayload } from 'jose';

/** Runtime options consumed by AuthgearTokenService. */
export interface AuthgearModuleOptions {
  /** Authgear project endpoint, e.g. https://my-project.authgear.cloud */
  endpoint: string;
  /** If set, the verifier also asserts the token's `client_id` claim equals this. */
  clientID?: string;
  /** JWKS cache max age in milliseconds (passed to jose). */
  jwksCacheMaxAge?: number;
  /** Leeway in seconds applied to exp/iat checks. Default 0. */
  clockToleranceSeconds?: number;
}

/** Options accepted by AuthgearModule.forRoot(). */
export interface AuthgearModuleRootOptions extends AuthgearModuleOptions {
  /** Register AuthgearAuthGuard as a global APP_GUARD. Default false. */
  global?: boolean;
}

/** Options accepted by AuthgearModule.forRootAsync(). */
export interface AuthgearModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  /** Register AuthgearAuthGuard as a global APP_GUARD. Default false. */
  global?: boolean;
  /** Providers to inject into useFactory. */
  inject?: any[];
  /** Factory returning the runtime options. */
  useFactory: (
    ...args: any[]
  ) => AuthgearModuleOptions | Promise<AuthgearModuleOptions>;
}

/** Typed view over a verified Authgear JWT access token. */
export interface AuthgearClaims {
  /** Authgear user id (OIDC `sub`). */
  sub: string;
  /** Issuer (the Authgear endpoint). */
  iss: string;
  /** Audience (the Authgear endpoint). */
  aud: string | string[];
  /** The `client_id` claim, if present. */
  clientID?: string;
  /** https://authgear.com/claims/user/is_verified */
  isVerified?: boolean;
  /** https://authgear.com/claims/user/is_anonymous */
  isAnonymous?: boolean;
  /** https://authgear.com/claims/user/can_reauthenticate */
  canReauthenticate?: boolean;
  /** The full raw JWT payload, for custom claims. */
  raw: JWTPayload;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add src/authgear.constants.ts src/authgear.interfaces.ts
git commit -m "feat: add Authgear module constants and interfaces"
```

---

## Task 3: AuthgearTokenService (discovery + verification)

**Files:**
- Create: `test/test-tokens.ts`
- Create: `test/authgear-token.service.spec.ts`
- Create: `src/authgear-token.service.ts`

- [ ] **Step 1: Create the test helper `test/test-tokens.ts`**

```ts
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';

export const ENDPOINT = 'https://test-project.authgear.cloud';
export const JWKS_URI = `${ENDPOINT}/oauth2/jwks`;
export const DISCOVERY_URL = `${ENDPOINT}/.well-known/openid-configuration`;
export const KID = 'test-key';

export interface TestKeys {
  privateKey: KeyLike;
  publicJwk: Record<string, unknown>;
}

/** Generate an RS256 key pair and the matching public JWK (with kid/alg/use). */
export async function makeKeys(): Promise<TestKeys> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = (await exportJWK(publicKey)) as Record<string, unknown>;
  publicJwk.kid = KID;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  return { privateKey, publicJwk };
}

interface SignOptions {
  issuer?: string;
  audience?: string;
  clientID?: string;
  expiresIn?: string; // e.g. '1h' or '-1h' for already-expired
  extraClaims?: Record<string, unknown>;
}

/** Sign a JWT access token resembling Authgear's shape. */
export async function signToken(
  privateKey: KeyLike,
  opts: SignOptions = {},
): Promise<string> {
  const payload: Record<string, unknown> = {
    'https://authgear.com/claims/user/is_verified': true,
    'https://authgear.com/claims/user/is_anonymous': false,
    'https://authgear.com/claims/user/can_reauthenticate': true,
    client_id: opts.clientID ?? '497d841ea22f33d3',
    ...opts.extraClaims,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject('e3079029-f123-4c56-80c1-c2cd63a5b6af')
    .setIssuedAt()
    .setIssuer(opts.issuer ?? ENDPOINT)
    .setAudience(opts.audience ?? ENDPOINT)
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(privateKey);
}

/**
 * Install a global.fetch mock that serves the OIDC discovery document and JWKS.
 * Returns a restore function.
 */
export function mockAuthgearFetch(publicJwk: Record<string, unknown>): () => void {
  const original = global.fetch;
  global.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input);
    if (url === DISCOVERY_URL) {
      return new Response(
        JSON.stringify({ issuer: ENDPOINT, jwks_uri: JWKS_URI }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url === JWKS_URI) {
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return () => {
    global.fetch = original;
  };
}
```

- [ ] **Step 2: Write the failing test `test/authgear-token.service.spec.ts`**

```ts
import { AuthgearTokenService } from '../src/authgear-token.service';
import {
  ENDPOINT,
  makeKeys,
  mockAuthgearFetch,
  signToken,
  type TestKeys,
} from './test-tokens';
import { generateKeyPair } from 'jose';

describe('AuthgearTokenService', () => {
  let keys: TestKeys;
  let restoreFetch: () => void;

  beforeAll(async () => {
    keys = await makeKeys();
  });

  beforeEach(() => {
    restoreFetch = mockAuthgearFetch(keys.publicJwk);
  });

  afterEach(() => {
    restoreFetch();
  });

  async function buildService(clientID?: string): Promise<AuthgearTokenService> {
    const service = new AuthgearTokenService({ endpoint: ENDPOINT, clientID });
    await service.onModuleInit();
    return service;
  }

  it('verifies a valid token and maps claims', async () => {
    const service = await buildService();
    const token = await signToken(keys.privateKey);
    const claims = await service.verifyToken(token);
    expect(claims.sub).toBe('e3079029-f123-4c56-80c1-c2cd63a5b6af');
    expect(claims.iss).toBe(ENDPOINT);
    expect(claims.isVerified).toBe(true);
    expect(claims.isAnonymous).toBe(false);
    expect(claims.clientID).toBe('497d841ea22f33d3');
    expect(claims.raw.sub).toBe(claims.sub);
  });

  it('rejects an expired token', async () => {
    const service = await buildService();
    const token = await signToken(keys.privateKey, { expiresIn: '-1h' });
    await expect(service.verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token with the wrong issuer', async () => {
    const service = await buildService();
    const token = await signToken(keys.privateKey, {
      issuer: 'https://evil.example.com',
    });
    await expect(service.verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token with the wrong audience', async () => {
    const service = await buildService();
    const token = await signToken(keys.privateKey, {
      audience: 'https://someone-else.authgear.cloud',
    });
    await expect(service.verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token signed by an unknown key', async () => {
    const service = await buildService();
    const other = await generateKeyPair('RS256');
    const token = await signToken(other.privateKey); // header kid still "test-key"
    await expect(service.verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token whose client_id does not match configured clientID', async () => {
    const service = await buildService('expected-client');
    const token = await signToken(keys.privateKey, { clientID: 'other-client' });
    await expect(service.verifyToken(token)).rejects.toThrow();
  });

  it('accepts a token whose client_id matches configured clientID', async () => {
    const service = await buildService('expected-client');
    const token = await signToken(keys.privateKey, { clientID: 'expected-client' });
    const claims = await service.verifyToken(token);
    expect(claims.clientID).toBe('expected-client');
  });

  it('throws if verifyToken is called before initialization', async () => {
    const service = new AuthgearTokenService({ endpoint: ENDPOINT });
    await expect(service.verifyToken('x')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest test/authgear-token.service.spec.ts`
Expected: FAIL — cannot find module `../src/authgear-token.service`.

- [ ] **Step 4: Implement `src/authgear-token.service.ts`**

```ts
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { AUTHGEAR_MODULE_OPTIONS } from './authgear.constants';
import type {
  AuthgearClaims,
  AuthgearModuleOptions,
} from './authgear.interfaces';

const CLAIM_IS_VERIFIED = 'https://authgear.com/claims/user/is_verified';
const CLAIM_IS_ANONYMOUS = 'https://authgear.com/claims/user/is_anonymous';
const CLAIM_CAN_REAUTH = 'https://authgear.com/claims/user/can_reauthenticate';

interface OidcConfiguration {
  issuer: string;
  jwks_uri: string;
}

@Injectable()
export class AuthgearTokenService implements OnModuleInit {
  private jwks?: JWTVerifyGetKey;
  private issuer?: string;

  constructor(
    @Inject(AUTHGEAR_MODULE_OPTIONS)
    private readonly options: AuthgearModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = await this.discover();
    this.issuer = config.issuer;
    this.jwks = createRemoteJWKSet(new URL(config.jwks_uri), {
      cacheMaxAge: this.options.jwksCacheMaxAge,
    });
  }

  private async discover(): Promise<OidcConfiguration> {
    const url = `${this.options.endpoint.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Authgear OIDC discovery failed (${res.status}) for ${url}`,
      );
    }
    const config = (await res.json()) as Partial<OidcConfiguration>;
    if (!config.issuer || !config.jwks_uri) {
      throw new Error(
        'Authgear OIDC discovery document is missing issuer or jwks_uri',
      );
    }
    return config as OidcConfiguration;
  }

  async verifyToken(token: string): Promise<AuthgearClaims> {
    if (!this.jwks || !this.issuer) {
      throw new Error('AuthgearTokenService is not initialized');
    }
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.options.endpoint,
      clockTolerance: this.options.clockToleranceSeconds ?? 0,
    });

    if (
      this.options.clientID &&
      payload.client_id !== this.options.clientID
    ) {
      throw new Error('Token client_id does not match configured clientID');
    }

    return this.toClaims(payload);
  }

  private toClaims(payload: JWTPayload): AuthgearClaims {
    return {
      sub: payload.sub as string,
      iss: payload.iss as string,
      aud: payload.aud as string | string[],
      clientID: payload.client_id as string | undefined,
      isVerified: payload[CLAIM_IS_VERIFIED] as boolean | undefined,
      isAnonymous: payload[CLAIM_IS_ANONYMOUS] as boolean | undefined,
      canReauthenticate: payload[CLAIM_CAN_REAUTH] as boolean | undefined,
      raw: payload,
    };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest test/authgear-token.service.spec.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/authgear-token.service.ts test/test-tokens.ts test/authgear-token.service.spec.ts
git commit -m "feat: add AuthgearTokenService with OIDC discovery and JWT verification"
```

---

## Task 4: @Public() decorator

**Files:**
- Create: `test/public.decorator.spec.ts`
- Create: `src/decorators/public.decorator.ts`

- [ ] **Step 1: Write the failing test `test/public.decorator.spec.ts`**

```ts
import 'reflect-metadata';
import { Public } from '../src/decorators/public.decorator';
import { IS_PUBLIC_KEY } from '../src/authgear.constants';

describe('@Public()', () => {
  it('sets the public metadata flag to true on a method', () => {
    class Controller {
      @Public()
      handler() {}
    }
    const value = Reflect.getMetadata(IS_PUBLIC_KEY, Controller.prototype.handler);
    expect(value).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/public.decorator.spec.ts`
Expected: FAIL — cannot find module `../src/decorators/public.decorator`.

- [ ] **Step 3: Implement `src/decorators/public.decorator.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../authgear.constants';

/** Mark a route or controller as public so AuthgearAuthGuard skips it. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/public.decorator.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/decorators/public.decorator.ts test/public.decorator.spec.ts
git commit -m "feat: add @Public() decorator"
```

---

## Task 5: @CurrentUser() decorator

**Files:**
- Create: `test/current-user.decorator.spec.ts`
- Create: `src/decorators/current-user.decorator.ts`

- [ ] **Step 1: Write the failing test `test/current-user.decorator.spec.ts`**

```ts
import type { ExecutionContext } from '@nestjs/common';
import { currentUserFactory } from '../src/decorators/current-user.decorator';
import { AUTHGEAR_REQUEST_PROPERTY } from '../src/authgear.constants';
import type { AuthgearClaims } from '../src/authgear.interfaces';

function mockContext(claims?: AuthgearClaims): ExecutionContext {
  const request: any = {};
  if (claims) request[AUTHGEAR_REQUEST_PROPERTY] = claims;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const claims: AuthgearClaims = {
  sub: 'user-123',
  iss: 'https://test.authgear.cloud',
  aud: 'https://test.authgear.cloud',
  raw: { sub: 'user-123' },
};

describe('currentUserFactory', () => {
  it('returns the full claims object when no field is requested', () => {
    expect(currentUserFactory(undefined, mockContext(claims))).toEqual(claims);
  });

  it('returns a single field when requested', () => {
    expect(currentUserFactory('sub', mockContext(claims))).toBe('user-123');
  });

  it('returns undefined when no claims are present', () => {
    expect(currentUserFactory(undefined, mockContext())).toBeUndefined();
  });

  it('returns undefined for a field when no claims are present', () => {
    expect(currentUserFactory('sub', mockContext())).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/current-user.decorator.spec.ts`
Expected: FAIL — cannot find module `../src/decorators/current-user.decorator`.

- [ ] **Step 3: Implement `src/decorators/current-user.decorator.ts`**

```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AUTHGEAR_REQUEST_PROPERTY } from '../authgear.constants';
import type { AuthgearClaims } from '../authgear.interfaces';

/** Extraction logic, separated for unit testing. */
export function currentUserFactory(
  data: keyof AuthgearClaims | undefined,
  ctx: ExecutionContext,
): AuthgearClaims | AuthgearClaims[keyof AuthgearClaims] | undefined {
  const request = ctx.switchToHttp().getRequest();
  const claims: AuthgearClaims | undefined =
    request[AUTHGEAR_REQUEST_PROPERTY];
  if (!claims) return undefined;
  return data ? claims[data] : claims;
}

/** Inject the verified Authgear claims (or a single field) into a handler. */
export const CurrentUser = createParamDecorator(currentUserFactory);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/current-user.decorator.spec.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/decorators/current-user.decorator.ts test/current-user.decorator.spec.ts
git commit -m "feat: add @CurrentUser() decorator"
```

---

## Task 6: AuthgearAuthGuard

**Files:**
- Create: `test/authgear-auth.guard.spec.ts`
- Create: `src/authgear-auth.guard.ts`

- [ ] **Step 1: Write the failing test `test/authgear-auth.guard.spec.ts`**

```ts
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthgearAuthGuard } from '../src/authgear-auth.guard';
import { AUTHGEAR_REQUEST_PROPERTY } from '../src/authgear.constants';
import type { AuthgearClaims } from '../src/authgear.interfaces';

const claims: AuthgearClaims = {
  sub: 'user-123',
  iss: 'https://test.authgear.cloud',
  aud: 'https://test.authgear.cloud',
  raw: { sub: 'user-123' },
};

function mockContext(headers: Record<string, string>): {
  ctx: ExecutionContext;
  request: any;
} {
  const request: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('AuthgearAuthGuard', () => {
  function buildGuard(opts: {
    isPublic?: boolean;
    verify?: jest.Mock;
  }) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(opts.isPublic ?? false),
    } as unknown as Reflector;
    const tokenService = {
      verifyToken: opts.verify ?? jest.fn().mockResolvedValue(claims),
    } as any;
    return new AuthgearAuthGuard(reflector, tokenService);
  }

  it('allows public routes without a token', async () => {
    const guard = buildGuard({ isPublic: true });
    const { ctx } = mockContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects when the Authorization header is missing', async () => {
    const guard = buildGuard({});
    const { ctx } = mockContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the Authorization scheme is not Bearer', async () => {
    const guard = buildGuard({});
    const { ctx } = mockContext({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches claims and allows a valid token', async () => {
    const verify = jest.fn().mockResolvedValue(claims);
    const guard = buildGuard({ verify });
    const { ctx, request } = mockContext({ authorization: 'Bearer good.token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('good.token');
    expect(request[AUTHGEAR_REQUEST_PROPERTY]).toEqual(claims);
  });

  it('rejects when verification throws', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('bad token'));
    const guard = buildGuard({ verify });
    const { ctx } = mockContext({ authorization: 'Bearer bad.token' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/authgear-auth.guard.spec.ts`
Expected: FAIL — cannot find module `../src/authgear-auth.guard`.

- [ ] **Step 3: Implement `src/authgear-auth.guard.ts`**

```ts
import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTHGEAR_REQUEST_PROPERTY,
  IS_PUBLIC_KEY,
} from './authgear.constants';
import { AuthgearTokenService } from './authgear-token.service';

@Injectable()
export class AuthgearAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: AuthgearTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const claims = await this.tokenService.verifyToken(token);
      request[AUTHGEAR_REQUEST_PROPERTY] = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }

  private extractToken(request: {
    headers?: Record<string, string | undefined>;
  }): string | undefined {
    const header = request.headers?.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return undefined;
    return value;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/authgear-auth.guard.spec.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/authgear-auth.guard.ts test/authgear-auth.guard.spec.ts
git commit -m "feat: add AuthgearAuthGuard"
```

---

## Task 7: AuthgearModule

**Files:**
- Create: `src/authgear.module.ts`

(Module wiring is verified by the e2e test in Task 8; this task adds the module and a compile check.)

- [ ] **Step 1: Implement `src/authgear.module.ts`**

```ts
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTHGEAR_MODULE_OPTIONS } from './authgear.constants';
import { AuthgearAuthGuard } from './authgear-auth.guard';
import { AuthgearTokenService } from './authgear-token.service';
import type {
  AuthgearModuleAsyncOptions,
  AuthgearModuleRootOptions,
} from './authgear.interfaces';

@Module({})
export class AuthgearModule {
  static forRoot(options: AuthgearModuleRootOptions): DynamicModule {
    const { global, ...runtimeOptions } = options;
    return {
      module: AuthgearModule,
      global: true,
      providers: [
        { provide: AUTHGEAR_MODULE_OPTIONS, useValue: runtimeOptions },
        AuthgearTokenService,
        AuthgearAuthGuard,
        ...(global
          ? [{ provide: APP_GUARD, useClass: AuthgearAuthGuard }]
          : []),
      ],
      exports: [AuthgearTokenService, AuthgearAuthGuard],
    };
  }

  static forRootAsync(options: AuthgearModuleAsyncOptions): DynamicModule {
    return {
      module: AuthgearModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: AUTHGEAR_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        AuthgearTokenService,
        AuthgearAuthGuard,
        ...(options.global
          ? [{ provide: APP_GUARD, useClass: AuthgearAuthGuard }]
          : []),
      ],
      exports: [AuthgearTokenService, AuthgearAuthGuard],
    };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/authgear.module.ts
git commit -m "feat: add AuthgearModule with forRoot and forRootAsync"
```

---

## Task 8: Public barrel + end-to-end test

**Files:**
- Create: `src/index.ts`
- Create: `test/app.e2e-spec.ts`

- [ ] **Step 1: Create `src/index.ts`**

```ts
export { AuthgearModule } from './authgear.module';
export { AuthgearAuthGuard } from './authgear-auth.guard';
export { AuthgearTokenService } from './authgear-token.service';
export { Public } from './decorators/public.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export {
  AUTHGEAR_MODULE_OPTIONS,
  IS_PUBLIC_KEY,
  AUTHGEAR_REQUEST_PROPERTY,
} from './authgear.constants';
export type {
  AuthgearModuleOptions,
  AuthgearModuleRootOptions,
  AuthgearModuleAsyncOptions,
  AuthgearClaims,
} from './authgear.interfaces';
```

- [ ] **Step 2: Write the failing e2e test `test/app.e2e-spec.ts`**

```ts
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthgearModule } from '../src/authgear.module';
import { Public } from '../src/decorators/public.decorator';
import { CurrentUser } from '../src/decorators/current-user.decorator';
import {
  ENDPOINT,
  makeKeys,
  mockAuthgearFetch,
  signToken,
  type TestKeys,
} from './test-tokens';

@Controller()
class TestController {
  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Get('protected')
  protectedRoute(@CurrentUser('sub') sub: string) {
    return { sub };
  }
}

describe('AuthgearModule (e2e)', () => {
  let app: INestApplication;
  let keys: TestKeys;
  let restoreFetch: () => void;

  beforeAll(async () => {
    keys = await makeKeys();
    restoreFetch = mockAuthgearFetch(keys.publicJwk);

    const moduleRef = await Test.createTestingModule({
      imports: [AuthgearModule.forRoot({ endpoint: ENDPOINT, global: true })],
      controllers: [TestController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    restoreFetch();
  });

  it('allows public routes without a token', async () => {
    await request(app.getHttpServer())
      .get('/public')
      .expect(200, { ok: true });
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/protected').expect(401);
  });

  it('allows protected routes with a valid token and injects claims', async () => {
    const token = await signToken(keys.privateKey);
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { sub: 'e3079029-f123-4c56-80c1-c2cd63a5b6af' });
  });

  it('rejects protected routes with a malformed token', async () => {
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails (then passes)**

Run: `npx jest test/app.e2e-spec.ts`
Expected: PASS — the module wiring is already implemented, so this confirms end-to-end behavior (4 tests green). If `src/index.ts` had an export typo it would fail to compile here.

- [ ] **Step 4: Run the full suite**

Run: `npx jest`
Expected: PASS — all suites (token service, both decorators, guard, e2e) green.

- [ ] **Step 5: Build to confirm a clean dist**

Run: `npx tsc -p tsconfig.build.json`
Expected: exit 0; `dist/index.js` and `dist/index.d.ts` exist.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts test/app.e2e-spec.ts
git commit -m "feat: add public barrel exports and end-to-end tests"
```

---

## Task 9: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage"
```

---

## Self-Review Notes

**Spec coverage:** module `forRoot`/`forRootAsync` (Task 7), JWT/JWKS offline verification with OIDC discovery (Task 3), `AuthgearAuthGuard` per-route + global via `APP_GUARD` (Tasks 6, 7), `@Public()` (Task 4), `@CurrentUser()` incl. single-field (Task 5), typed `AuthgearClaims` mapping Authgear's documented claims (Tasks 2, 3), 401 on missing/invalid token and startup error on discovery failure (Tasks 3, 6), and the full testing strategy — token service unit tests, guard tests, decorator tests, e2e app (Tasks 3–8). Non-goals (RBAC, session refresh/revoke, opaque validation, `@Protected()`) are intentionally absent.

**Type consistency:** `verifyToken`, `onModuleInit`, `currentUserFactory`, `AUTHGEAR_REQUEST_PROPERTY`, `AUTHGEAR_MODULE_OPTIONS`, `IS_PUBLIC_KEY`, and the `AuthgearClaims` field names are used identically across the service, guard, decorators, module, and barrel.
