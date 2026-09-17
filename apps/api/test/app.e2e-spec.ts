import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApplication } from '../src/bootstrap/configure-application';
import { HttpExceptionFilter } from '../src/core/filters/http-exception.filter';
import { ProxyThrottlerGuard } from '../src/core/throttling/proxy-throttler.guard';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

@Controller('platform')
class PlatformTestController {
  @Get('limited')
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  limited(): { ok: true } {
    return { ok: true };
  }

  @Get('error')
  error(): never {
    throw new BadRequestException('invalid request');
  }
}

describe('legacy HTTP contract (e2e)', () => {
  let app: INestApplication<App>;
  const loginResponse = {
    statusCode: 200,
    message: 'Login successful',
    data: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    },
  };
  const authService = {
    login: jest.fn().mockResolvedValue(loginResponse),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
      controllers: [AuthController, PlatformTestController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              ({
                SWAGGER_ENABLED: true,
                SWAGGER_PATH: 'api/docs',
                CORS_ORIGINS: 'http://localhost:5173',
                TRUST_PROXY: 'loopback',
                BODY_LIMIT: '1mb',
                API_PREFIX: 'api',
                API_VERSION: '1',
                SOCKET_PATH: '/socket.io',
                THROTTLE_ENABLED: true,
              })[key],
          },
        },
        { provide: APP_GUARD, useClass: ProxyThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApplication(
      app as NestExpressApplication,
      app.get(ConfigService),
      {
        useWebSocketAdapter: false,
      },
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login preserves the legacy response envelope', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'patient@example.com', password: 'StrongPass123!' })
      .expect(200)
      .expect(loginResponse);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'patient@example.com',
      password: 'StrongPass123!',
    });
  });

  it('rejects an invalid login payload at the HTTP boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-correlation-id', 'contract-test-123')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.headers['x-correlation-id']).toBe('contract-test-123');
    expect(response.body).toMatchObject({
      statusCode: 400,
      correlationId: 'contract-test-123',
      method: 'POST',
    });
  });

  it('applies Helmet and only exposes Swagger when configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/error')
      .expect(400);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('enforces route-level HTTP throttling', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/limited')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/platform/limited')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/platform/limited')
      .expect(429);
  });
});
