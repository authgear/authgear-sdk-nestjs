import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthgearModule } from '../src/authgear.module';
import { Public } from '../src/decorators/public.decorator';
import { CurrentUser } from '../src/decorators/current-user.decorator';
import {
  ENDPOINT,
  makeKeys,
  mockAuthgearFetch,
  signToken,
  type TestKeys,
} from './test-tokens';

@Controller()
class TestController {
  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Get('protected')
  protectedRoute(@CurrentUser('sub') sub: string) {
    return { sub };
  }
}

describe('AuthgearModule (e2e)', () => {
  let app: INestApplication;
  let keys: TestKeys;
  let restoreFetch: () => void;

  beforeAll(async () => {
    keys = await makeKeys();
    restoreFetch = mockAuthgearFetch(keys.publicJwk);

    const moduleRef = await Test.createTestingModule({
      imports: [AuthgearModule.forRoot({ endpoint: ENDPOINT, global: true })],
      controllers: [TestController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    restoreFetch();
  });

  it('allows public routes without a token', async () => {
    await request(app.getHttpServer())
      .get('/public')
      .expect(200, { ok: true });
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/protected').expect(401);
  });

  it('allows protected routes with a valid token and injects claims', async () => {
    const token = await signToken(keys.privateKey);
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { sub: 'e3079029-f123-4c56-80c1-c2cd63a5b6af' });
  });

  it('rejects protected routes with a malformed token', async () => {
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });
});
