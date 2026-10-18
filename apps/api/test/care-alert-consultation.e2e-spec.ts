import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Int32, ObjectId } from 'mongodb';
import { Connection, createConnection } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '../src/core/domain/user.enums';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { applyCc003Cc004EvaluationsAlerts } from '../src/database/migrations/202610020900-cc003-cc004-evaluations-alerts';
import { applyData001aConsultationContract } from '../src/database/migrations/202610152000-data001a-consultation-contract';
import { applyCc008CareAlertConsultationLink } from '../src/database/migrations/202610161000-cc008-care-alert-consultation-link';
import { CareAlertService } from '../src/modules/chronic-care/application/services/care-alert.service';
import {
  CareAlert,
  CareAlertSchema,
} from '../src/modules/chronic-care/domain/entities/care-alert.entity';
import {
  HealthEvaluation,
  HealthEvaluationSchema,
} from '../src/modules/chronic-care/domain/entities/health-evaluation.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from '../src/modules/chronic-care/domain/entities/patient-care-program.entity';
import { CareAlertController } from '../src/modules/chronic-care/presentation/controllers/care-alert.controller';
import { CareAlertConsultationService } from '../src/modules/consultations/application/services/consultations/care-alert-consultation.service';
import {
  Consultation,
  ConsultationSchema,
} from '../src/modules/consultations/domain/entities/consultations/consultation.entity';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';

jest.setTimeout(30_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc008_test?replicaSet=rs0&directConnection=true';

@Injectable()
class HeaderAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { id: string; role: UserRole };
    }>();
    request.user = {
      id: String(request.headers['x-user-id']),
      role: request.headers['x-user-role'] as UserRole,
    };
    return true;
  }
}

describe('CC-008 Care alert consultation link (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  const outbox = { enqueue: jest.fn().mockResolvedValue({}) };
  const usage = {
    prepare: jest.fn().mockResolvedValue(undefined),
    reserve: jest.fn().mockResolvedValue({ status: 'reserved', created: true }),
  };
  const doctorId = new ObjectId();
  const otherDoctorId = new ObjectId();
  const patientId = new ObjectId();
  const enrollmentId = new ObjectId();
  const alertId = new ObjectId();
  const onDemandAlertId = new ObjectId();

  const asActor = (id: ObjectId, role: UserRole) => ({
    'x-user-id': id.toHexString(),
    'x-user-role': role,
  });

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc008_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    const database = connection.db!;
    await applyCc003Cc004EvaluationsAlerts(database);
    await applyData001aConsultationContract(database);
    await applyCc008CareAlertConsultationLink(database);

    const now = new Date();
    await database.collection('carealerts').insertMany(
      [alertId, onDemandAlertId].map((id, index) => ({
        _id: id,
        revision: new Int32(1),
        patientCareProgramId: enrollmentId,
        evaluationId: new ObjectId(),
        patientId,
        assignedDoctorId: doctorId,
        severity: 'urgent',
        status: 'open',
        reasonCodes: [`cc008-${index}`],
        uniqueKey: `cc008-alert-${index}`,
        detectedAt: now,
        createdAt: now,
      })),
    );

    const alerts = connection.model(CareAlert.name, CareAlertSchema);
    const evaluations = connection.model(
      HealthEvaluation.name,
      HealthEvaluationSchema,
    );
    const enrollments = connection.model(
      PatientCareProgram.name,
      PatientCareProgramSchema,
    );
    const audits = connection.model(AuditLog.name, AuditLogSchema);
    const consultations = connection.model(
      Consultation.name,
      ConsultationSchema,
    );
    const consultationPort = new CareAlertConsultationService(
      consultations as never,
      audits,
      connection,
      outbox as never,
      usage as never,
    );
    const service = new CareAlertService(
      alerts as never,
      evaluations as never,
      enrollments as never,
      audits,
      connection,
      {} as never,
      consultationPort,
    );
    const module = await Test.createTestingModule({
      controllers: [CareAlertController],
      providers: [{ provide: CareAlertService, useValue: service }, RolesGuard],
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

  afterAll(async () => {
    if (app) await app.close();
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('rejects a patient and a doctor who is not assigned to the alert', async () => {
    await request(app.getHttpServer())
      .post(`/care-alerts/${alertId}/consultations`)
      .set(asActor(patientId, UserRole.PATIENT))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/care-alerts/${alertId}/consultations`)
      .set(asActor(otherDoctorId, UserRole.DOCTOR))
      .expect(403);
  });

  it('creates one scheduled consultation, records follow-up, and makes retry idempotent', async () => {
    const body = {
      scheduledStartAt: '2030-01-01T09:00:00.000Z',
      timezone: 'Asia/Ho_Chi_Minh',
      expectedDurationMinutes: 45,
      followUpNote: 'Review home blood-pressure log.',
      nextAction: 'Schedule clinical review.',
    };
    const first = await request(app.getHttpServer())
      .post(`/care-alerts/${alertId}/consultations`)
      .set(asActor(doctorId, UserRole.DOCTOR))
      .send(body)
      .expect(201);
    expect(first.body.created).toBe(true);

    const retry = await request(app.getHttpServer())
      .post(`/care-alerts/${alertId}/consultations`)
      .set(asActor(doctorId, UserRole.DOCTOR))
      .send(body)
      .expect(201);
    expect(retry.body).toEqual({ id: first.body.id, created: false });

    const consultation = await connection
      .db!.collection('consultations')
      .findOne({ _id: new ObjectId(first.body.id) });
    expect(consultation).toMatchObject({
      careAlertId: alertId,
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      mode: 'scheduled',
      requestStatus: 'accepted',
      sessionStatus: 'waiting',
      expectedDurationMinutes: 45,
      followUp: {
        note: body.followUpNote,
        nextAction: body.nextAction,
      },
    });
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('creates an on-demand consultation when no schedule is supplied', async () => {
    const response = await request(app.getHttpServer())
      .post(`/care-alerts/${onDemandAlertId}/consultations`)
      .set(asActor(doctorId, UserRole.DOCTOR))
      .send({ expectedDurationMinutes: 30 })
      .expect(201);
    const consultation = await connection
      .db!.collection('consultations')
      .findOne({ _id: new ObjectId(response.body.id) });
    expect(consultation).toMatchObject({
      careAlertId: onDemandAlertId,
      mode: 'on_demand',
      expectedDurationMinutes: 30,
    });
    expect(consultation?.scheduledStartAt).toBeUndefined();
  });
});
