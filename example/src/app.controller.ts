import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Public, type AuthgearClaims } from '@authgear/nestjs';

@Controller()
export class AppController {
  /** Public route — no token required (whitelisted via @Public()). */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  /** Protected route — requires a valid Authgear bearer token. */
  @Get('me')
  me(@CurrentUser() user: AuthgearClaims) {
    return {
      sub: user.sub,
      isVerified: user.isVerified,
      isAnonymous: user.isAnonymous,
      canReauthenticate: user.canReauthenticate,
    };
  }
}
