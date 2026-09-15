import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

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
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
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
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
  });
});
