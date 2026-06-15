import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AUTHGEAR_REQUEST_PROPERTY } from '../authgear.constants';
import type { AuthgearClaims } from '../authgear.interfaces';

/** Extraction logic, separated for unit testing. */
export function currentUserFactory(
  data: keyof AuthgearClaims | undefined,
  ctx: ExecutionContext,
): AuthgearClaims | AuthgearClaims[keyof AuthgearClaims] | undefined {
  const request = ctx.switchToHttp().getRequest();
  const claims: AuthgearClaims | undefined = request[AUTHGEAR_REQUEST_PROPERTY];
  if (!claims) return undefined;
  return data ? claims[data] : claims;
}

/** Inject the verified Authgear claims (or a single field) into a handler. */
export const CurrentUser = createParamDecorator(currentUserFactory);
