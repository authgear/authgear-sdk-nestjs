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
