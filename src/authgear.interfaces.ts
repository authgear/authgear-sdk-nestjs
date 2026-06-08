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
