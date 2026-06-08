import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AUTHGEAR_MODULE_OPTIONS } from './authgear.constants';
import { AuthgearAuthGuard } from './authgear-auth.guard';
import { AuthgearTokenService } from './authgear-token.service';
import type {
  AuthgearModuleAsyncOptions,
  AuthgearModuleRootOptions,
} from './authgear.interfaces';

@Module({})
export class AuthgearModule {
  static forRoot(options: AuthgearModuleRootOptions): DynamicModule {
    const { global, ...runtimeOptions } = options;
    return {
      module: AuthgearModule,
      global: true,
      providers: [
        { provide: AUTHGEAR_MODULE_OPTIONS, useValue: runtimeOptions },
        AuthgearTokenService,
        AuthgearAuthGuard,
        ...(global
          ? [{ provide: APP_GUARD, useExisting: AuthgearAuthGuard }]
          : []),
      ],
      exports: [AuthgearTokenService, AuthgearAuthGuard],
    };
  }

  static forRootAsync(options: AuthgearModuleAsyncOptions): DynamicModule {
    return {
      module: AuthgearModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: AUTHGEAR_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        AuthgearTokenService,
        AuthgearAuthGuard,
        ...(options.global
          ? [{ provide: APP_GUARD, useExisting: AuthgearAuthGuard }]
          : []),
      ],
      exports: [AuthgearTokenService, AuthgearAuthGuard],
    };
  }
}
