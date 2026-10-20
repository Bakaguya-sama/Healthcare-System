import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { HealthMetricsService } from '../src/modules/health-tracking/application/services/health-metrics.service';
import { HealthMetricsController } from '../src/modules/health-tracking/presentation/controllers/health-metrics.controller';

@Injectable()
class HeaderAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { sub: string };
    }>();
    const subject = request.headers['x-user-id'];
    if (!subject) return false;
    request.user = { sub: subject };
    return true;
  }
}

describe('health metric ingestion authorization (e2e)', () => {
  let app: INestApplication<App>;
  const service = { create: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthMetricsController],
      providers: [{ provide: HealthMetricsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderAuthenticationGuard)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => app?.close());

  beforeEach(() => service.create.mockReset().mockResolvedValue({ ok: true }));

  it('rejects an unauthenticated metric submission', async () => {
    await request(app.getHttpServer())
      .post('/health-metrics')
      .send({
        metricType: 'blood_pressure',
        values: { systolic: 120, diastolic: 80 },
      })
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('uses the authenticated subject, never a patient identifier from the body', async () => {
    await request(app.getHttpServer())
      .post('/health-metrics')
      .set('x-user-id', 'patient-authenticated-subject')
      .send({
        patientId: 'another-patient',
        metricType: 'blood_pressure',
        values: { systolic: 120, diastolic: 80 },
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      'patient-authenticated-subject',
      expect.not.objectContaining({ patientId: expect.anything() }),
    );
  });
});
