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
