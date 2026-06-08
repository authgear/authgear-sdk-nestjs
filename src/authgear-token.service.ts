import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  createLocalJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JSONWebKeySet,
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

const DEFAULT_JWKS_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const JWKS_REFRESH_COOLDOWN = 30 * 1000; // 30 seconds

interface OidcConfiguration {
  issuer: string;
  jwks_uri: string;
}

@Injectable()
export class AuthgearTokenService implements OnModuleInit {
  private issuer?: string;
  private jwksUri?: string;
  private jwks?: JWTVerifyGetKey;
  private jwksFetchedAt = 0;
  private lastRefreshAttempt = 0;

  constructor(
    @Inject(AUTHGEAR_MODULE_OPTIONS)
    private readonly options: AuthgearModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = await this.discover();
    this.issuer = config.issuer;
    this.jwksUri = config.jwks_uri;
    await this.refreshJwks();
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

  // Redundant concurrent refreshes are tolerated by design: refreshes are
  // idempotent and last writer wins, so we intentionally skip in-flight de-duplication.
  private async refreshJwks(): Promise<void> {
    if (!this.jwksUri) {
      throw new Error('AuthgearTokenService is not initialized');
    }
    this.lastRefreshAttempt = Date.now();
    const res = await fetch(this.jwksUri);
    if (!res.ok) {
      throw new Error(
        `Authgear JWKS fetch failed (${res.status}) for ${this.jwksUri}`,
      );
    }
    const jwks = (await res.json()) as JSONWebKeySet;
    this.jwks = createLocalJWKSet(jwks);
    this.jwksFetchedAt = Date.now();
  }

  async verifyToken(token: string): Promise<AuthgearClaims> {
    if (!this.jwks || !this.issuer) {
      throw new Error('AuthgearTokenService is not initialized');
    }
    // Proactively refresh a stale key set so rotated keys are picked up.
    if (this.isJwksStale()) {
      await this.refreshJwks();
    }

    let payload: JWTPayload;
    try {
      payload = await this.verifyWith(token);
    } catch (err) {
      // The signing key may have rotated since the last fetch — refresh once and retry.
      if (
        err instanceof joseErrors.JWKSNoMatchingKey &&
        this.canRetryRefresh()
      ) {
        await this.refreshJwks();
        payload = await this.verifyWith(token);
      } else {
        throw err;
      }
    }

    if (this.options.clientID && payload.client_id !== this.options.clientID) {
      throw new Error('Token client_id does not match configured clientID');
    }
    return this.toClaims(payload);
  }

  private async verifyWith(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.jwks!, {
      issuer: this.issuer,
      audience: this.options.endpoint,
      clockTolerance: this.options.clockToleranceSeconds ?? 0,
    });
    return payload;
  }

  private isJwksStale(): boolean {
    const maxAge = this.options.jwksCacheMaxAge ?? DEFAULT_JWKS_CACHE_MAX_AGE;
    return Date.now() - this.jwksFetchedAt > maxAge;
  }

  // lastRefreshAttempt is updated by BOTH the proactive staleness refresh and the
  // retry refresh, intentionally capping total JWKS refetches within the cooldown window.
  private canRetryRefresh(): boolean {
    return Date.now() - this.lastRefreshAttempt > JWKS_REFRESH_COOLDOWN;
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
