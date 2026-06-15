import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthgearModule } from '@authgear/nestjs';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthgearModule.forRootAsync({
      // Register AuthgearAuthGuard globally so every route is protected
      // unless explicitly marked with @Public().
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        endpoint: config.getOrThrow<string>('AUTHGEAR_ENDPOINT'),
        clientID: config.get<string>('AUTHGEAR_CLIENT_ID'),
      }),
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
