import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../authgear.constants';

/** Mark a route or controller as public so AuthgearAuthGuard skips it. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
