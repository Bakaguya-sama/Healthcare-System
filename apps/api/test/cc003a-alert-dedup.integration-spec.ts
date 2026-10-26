import { createConnection, type Connection, Types } from 'mongoose';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/domain/entities/audit-log.entity';
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
import { CareAlertService } from '../src/modules/chronic-care/application/services/care-alert.service';

jest.setTimeout(30_000);
const baseUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_cc003a?replicaSet=rs0&directConnection=true';

describe('CC-003A alert deduplication', () => {
  let connection: Connection;
  let service: CareAlertService;
  const enrollmentId = new Types.ObjectId();
  const patientId = new Types.ObjectId();
  const doctorId = new Types.ObjectId();
  const ruleId = new Types.ObjectId();

  beforeAll(async () => {
    const uri = new URL(baseUri);
    uri.pathname = `/healthcare_cc003a_alert_${new Types.ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), {
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
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
    const events = connection.model(OutboxEvent.name, OutboxEventSchema);
    await Promise.all([
      alerts.init(),
      evaluations.init(),
      audits.init(),
      events.init(),
    ]);
    await enrollments.collection.insertOne({
      _id: enrollmentId,
      patientId,
      doctorId,
      timezone: 'Asia/Ho_Chi_Minh',
    });
    service = new CareAlertService(
      alerts as never,
      evaluations as never,
      enrollments as never,
      audits as never,
      connection,
      new OutboxService(events as never),
    );
  });
  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  function evaluation(
    severity: 'attention' | 'urgent',
    recordedAt = '2026-10-19T03:00:00.000Z',
  ) {
    return {
      _id: new Types.ObjectId(),
      patientCareProgramId: enrollmentId,
      careRuleId: ruleId,
      severity,
      reasonCodes: [severity],
      timeRange: { startAt: new Date(recordedAt) },
      evaluatedAt: new Date(),
    } as never;
  }

  it('escalates the same local-day alert, sends urgent notification once, and creates a new alert after closure', async () => {
    const attention = evaluation('attention');
    const urgent = evaluation('urgent', '2026-10-19T05:00:00.000Z');
    const first = await service.createForEvaluation(attention);
    const escalated = await service.createForEvaluation(urgent);
    expect(String(escalated?._id)).toBe(String(first?._id));
    expect(escalated?.severity).toBe('urgent');
    await service.createForEvaluation(urgent);
    expect(
      await connection
        .model(OutboxEvent.name)
        .countDocuments({ eventType: 'care.alert.escalated' }),
    ).toBe(1);
    await service.transition(
      { id: String(doctorId), role: 'doctor' } as never,
      String(escalated?._id),
      'resolve',
      escalated!.revision,
    );
    const next = await service.createForEvaluation(
      evaluation('urgent', '2026-10-19T06:00:00.000Z'),
    );
    expect(String(next?._id)).not.toBe(String(first?._id));
    expect(await connection.model(CareAlert.name).countDocuments()).toBe(2);
    await service.createForEvaluation(urgent);
    expect(await connection.model(CareAlert.name).countDocuments()).toBe(2);
  });

  it('concurrent same-day evaluations leave only one active alert and retain urgent severity', async () => {
    const [first, second] = await Promise.all([
      service.createForEvaluation(
        evaluation('attention', '2026-10-20T03:00:00.000Z'),
      ),
      service.createForEvaluation(
        evaluation('urgent', '2026-10-20T04:00:00.000Z'),
      ),
    ]);
    expect(String(first?._id)).toBe(String(second?._id));
    const active = await connection
      .model<CareAlert>(CareAlert.name)
      .findOne({
        activeDeduplicationKey: `cc003a:${enrollmentId}:${ruleId}:2026-10-20`,
      })
      .lean();
    expect(active?.severity).toBe('urgent');
  });
});
