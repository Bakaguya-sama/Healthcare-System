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
import { applyCc005DoctorPriorityInbox } from '../src/database/migrations/202610061000-cc005-doctor-priority-inbox';
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
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';

jest.setTimeout(30_000);

const baseMongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc005_test?replicaSet=rs0&directConnection=true';

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

describe('CC-005 Doctor Priority Inbox (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;

  const doctorId = new ObjectId();
  const otherDoctorId = new ObjectId();
  const patientId = new ObjectId();
  const enrollmentId = new ObjectId();
  const ruleId = new ObjectId();
  const metricId = new ObjectId();
  const alertIds = [
    new ObjectId('700000000000000000000001'),
    new ObjectId('700000000000000000000002'),
    new ObjectId('700000000000000000000003'),
    new ObjectId('700000000000000000000004'),
  ];
  const evaluationIds = alertIds.map(() => new ObjectId());

  const asActor = (id: ObjectId, role: UserRole) => ({
    'x-user-id': id.toHexString(),
    'x-user-role': role,
  });

  beforeAll(async () => {
    const uri = new URL(baseMongoUri);
    uri.pathname = `/healthcare_cc005_${new ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    const database = connection.db!;
    await applyCc003Cc004EvaluationsAlerts(database);
    await applyCc005DoctorPriorityInbox(database);

    const detectedTimes = [
      new Date('2026-10-06T04:00:00.000Z'),
      new Date('2026-10-06T04:00:00.000Z'),
      new Date('2026-10-06T03:00:00.000Z'),
      new Date('2026-10-06T06:00:00.000Z'),
    ];
    const severities = ['urgent', 'urgent', 'urgent', 'attention'];

    await database.collection('healthevaluations').insertMany(
      evaluationIds.map((evaluationId, index) => ({
        _id: evaluationId,
        patientCareProgramId: enrollmentId,
        patientId,
        healthMetricId: metricId,
        careRuleId: ruleId,
        severity: severities[index],
        reasonCodes: [`reason-${index}`],
        inputData: { systolic: 150 + index },
        timeRange: { startAt: detectedTimes[index] },
        uniqueKey: `cc005-evaluation-${index}`,
        evaluatedAt: detectedTimes[index],
        createdAt: detectedTimes[index],
      })),
    );
    await database.collection('carealerts').insertMany([
      ...alertIds.map((alertId, index) => ({
        _id: alertId,
        revision: new Int32(1),
        patientCareProgramId: enrollmentId,
        evaluationId: evaluationIds[index],
        patientId,
        assignedDoctorId: doctorId,
        severity: severities[index],
        status: index === 2 ? 'acknowledged' : 'open',
        reasonCodes: [`reason-${index}`],
        uniqueKey: `cc005-alert-${index}`,
        detectedAt: detectedTimes[index],
        createdAt: detectedTimes[index],
      })),
      {
        revision: new Int32(1),
        patientCareProgramId: new ObjectId(),
        evaluationId: new ObjectId(),
        patientId: new ObjectId(),
        assignedDoctorId: otherDoctorId,
        severity: 'urgent',
        status: 'open',
        reasonCodes: ['other-doctor'],
        uniqueKey: 'cc005-other-doctor-alert',
        detectedAt: new Date('2026-10-06T07:00:00.000Z'),
        createdAt: new Date('2026-10-06T07:00:00.000Z'),
      },
    ]);
    await database.collection('auditlogs').insertOne({
      domain: 'care',
      entityType: 'careAlert',
      entityId: alertIds[1],
      actorId: doctorId,
      action: 'care_alert_created',
      toStatus: 'open',
      createdAt: new Date('2026-10-06T04:00:00.000Z'),
    });

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
    const service = new CareAlertService(
      alerts as never,
      evaluations as never,
      enrollments as never,
      audits,
      connection,
      {} as never,
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

  it.each([UserRole.PATIENT, UserRole.ADMIN])(
    'rejects the %s role at the inbox HTTP boundary',
    async (role) => {
      await request(app.getHttpServer())
        .get('/care-alerts')
        .set(asActor(patientId, role))
        .expect(403);
    },
  );

  it('returns only assigned alerts in stable priority order', async () => {
    const response = await request(app.getHttpServer())
      .get('/care-alerts?limit=10')
      .set(asActor(doctorId, UserRole.DOCTOR))
      .expect(200);

    expect(
      response.body.items.map((item: { _id: string }) => item._id),
    ).toEqual([
      alertIds[1].toHexString(),
      alertIds[0].toHexString(),
      alertIds[2].toHexString(),
      alertIds[3].toHexString(),
    ]);
    expect(response.body.items).toHaveLength(4);
  });

  it('paginates a fixed severity without duplicates or gaps', async () => {
    const first = await request(app.getHttpServer())
      .get('/care-alerts?severity=urgent&limit=2')
      .set(asActor(doctorId, UserRole.DOCTOR))
      .expect(200);
    expect(first.body).toMatchObject({ hasNextPage: true });

    const second = await request(app.getHttpServer())
      .get(
        `/care-alerts?severity=urgent&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
      )
      .set(asActor(doctorId, UserRole.DOCTOR))
      .expect(200);
    expect(second.body).toMatchObject({ hasNextPage: false, nextCursor: null });

    const ids = [...first.body.items, ...second.body.items].map(
      (item: { _id: string }) => item._id,
    );
    expect(ids).toEqual([
      alertIds[1].toHexString(),
      alertIds[0].toHexString(),
      alertIds[2].toHexString(),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('enforces the pagination hard limit', async () => {
    await request(app.getHttpServer())
      .get('/care-alerts?limit=101')
      .set(asActor(doctorId, UserRole.DOCTOR))
      .expect(400);
  });

  it('returns bounded detail only to the assigned doctor', async () => {
    await request(app.getHttpServer())
      .get(`/care-alerts/${alertIds[1]}/detail`)
      .set(asActor(otherDoctorId, UserRole.DOCTOR))
      .expect(404);

    const response = await request(app.getHttpServer())
      .get(`/care-alerts/${alertIds[1]}/detail`)
      .set(asActor(doctorId, UserRole.DOCTOR))
      .expect(200);
    expect(response.body).toMatchObject({
      _id: alertIds[1].toHexString(),
      allowedActions: ['acknowledge', 'resolve', 'dismiss'],
      evaluation: { _id: evaluationIds[1].toHexString() },
    });
    expect(response.body.timeline).toHaveLength(1);
  });
});
