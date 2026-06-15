import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTHGEAR_REQUEST_PROPERTY, IS_PUBLIC_KEY } from './authgear.constants';
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
