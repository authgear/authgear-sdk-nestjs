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
export async function makeKeys(kid: string = KID): Promise<TestKeys> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = (await exportJWK(publicKey)) as unknown as Record<
    string,
    unknown
  >;
  publicJwk.kid = kid;
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
  kid?: string;
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
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? KID })
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
export function mockAuthgearFetch(
  publicJwk: Record<string, unknown>,
): () => void {
  const original = global.fetch;
  global.fetch = (async (input: any) => {
    const url =
      typeof input === 'string' ? input : (input.url ?? String(input));
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
