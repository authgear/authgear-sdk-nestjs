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
