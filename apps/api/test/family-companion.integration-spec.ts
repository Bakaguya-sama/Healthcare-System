import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Connection, createConnection, Model, Types } from 'mongoose';
import { MongooseFamilyLinkRepository } from '../src/modules/family-companion/infrastructure/mongoose/mongoose-family-link.repository';
import { CreateFamilyInvitation } from '../src/modules/family-companion/application/use-cases/create-family-invitation.use-case';
import { RedeemFamilyInvitation } from '../src/modules/family-companion/application/use-cases/redeem-family-invitation.use-case';
import { AcceptFamilyInvitation } from '../src/modules/family-companion/application/use-cases/accept-family-invitation.use-case';
import { ExpireFamilyInvitations } from '../src/modules/family-companion/application/use-cases/expire-family-invitations.use-case';
import { RejectFamilyInvitation } from '../src/modules/family-companion/application/use-cases/reject-family-invitation.use-case';
import { ChangeFamilyLinkStatus } from '../src/modules/family-companion/application/use-cases/change-family-link-status.use-case';
import { MongooseFamilyInvitationCreationStore } from '../src/modules/family-companion/infrastructure/mongoose/mongoose-family-invitation-creation.store';
import {
  FamilyLink,
  FamilyLinkDocument,
  FamilyLinkSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-link.schema';
import {
  FamilyPermission,
  FamilyPermissionDocument,
  FamilyPermissionSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-permission.schema';
import { UserDocument } from '../src/modules/users/domain/entities/users/user.schema';
import {
  User,
  UserSchema,
} from '../src/modules/users/domain/entities/users/user.schema';
import { AccountStatus, UserRole } from '../src/core/domain/user.enums';
import { migrateDatabase } from '../src/database/migrations/run-migrations';
import {
  applyFamilyHealthSharing,
  FAMILY_HEALTH_SHARING_VERSION,
} from '../src/database/migrations/202611241020-e2-family-health-metric-sharing';
import { verifyDatabase } from '../src/database/verify-database';
import { MongooseFamilyHealthMetricSharingRepository } from '../src/modules/family-companion/infrastructure/mongoose/mongoose-family-health-metric-sharing.repository';
import {
  FamilyHealthMetricSharing,
  FamilyHealthMetricSharingSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-health-metric-sharing.schema';
import {
  FamilyCommandReceipt,
  FamilyCommandReceiptSchema,
} from '../src/modules/family-companion/infrastructure/mongoose/family-command-receipt.schema';
import {
  AuditLog,
  AuditLogSchema,
} from '../src/modules/platform-audit/public-api';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../src/infrastructure/outbox/entities/outbox-event.entity';
import { OutboxService } from '../src/infrastructure/outbox/outbox.service';
import {
  HealthMetric,
  HealthMetricSchema,
} from '../src/modules/health-tracking/domain/entities/health-metric.entity';
import { HealthMetricQueryService } from '../src/modules/health-tracking/application/services/health-metric-query.service';
import { MongooseSharedHealthMetricReader } from '../src/modules/health-tracking/infrastructure/mongoose/mongoose-shared-health-metric-reader';
import { ReadFamilyHealthMetrics } from '../src/modules/family-companion/application/queries/read-family-health-metrics';
import {
  Notification,
  NotificationSchema,
} from '../src/modules/notifications/domain/entities/notification.entity';
import { NotificationsService } from '../src/modules/notifications/application/services/notifications.service';
import { FamilyHealthSharingNotificationService } from '../src/modules/family-companion/infrastructure/outbox/family-health-sharing-notification.service';
import { OutboxWorkerService } from '../src/infrastructure/outbox/outbox-worker.service';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { FamilyHealthMetricsController } from '../src/modules/family-companion/presentation/controllers/family-health-metrics.controller';
import { GrantFamilyHealthMetricSharing } from '../src/modules/family-companion/application/use-cases/grant-family-health-metric-sharing.use-case';
import { RevokeFamilyHealthMetricSharing } from '../src/modules/family-companion/application/use-cases/revoke-family-health-metric-sharing.use-case';
import { JwtAuthGuard } from '../src/core/guards/jwt-auth.guard';
import { RolesGuard } from '../src/core/guards/roles.guard';
import { JwtStrategy } from '../src/modules/authentication/infrastructure/strategies/jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { FamilyLinksController } from '../src/modules/family-companion/presentation/controllers/family-links.controller';
import { UpdateFamilyReminderPermissions } from '../src/modules/family-companion/application/use-cases/update-family-reminder-permissions.use-case';
import { RegenerateFamilyInvitationArtifacts } from '../src/modules/family-companion/application/use-cases/regenerate-family-invitation-artifacts.use-case';
import { ReadFamilyLinks } from '../src/modules/family-companion/application/queries/read-family-links';

jest.setTimeout(120_000);

describe('Family Companion invitation lifecycle', () => {
  let connection: Connection;
  let testMongoUri: string;
  let familyLinkRepository: MongooseFamilyLinkRepository;
  let redeemInvitation: RedeemFamilyInvitation;
  let acceptInvitation: AcceptFamilyInvitation;
  let expireInvitations: ExpireFamilyInvitations;
  let rejectInvitation: RejectFamilyInvitation;
  let changeStatus: ChangeFamilyLinkStatus;
  let links: Model<FamilyLinkDocument>;
  let permissions: Model<FamilyPermissionDocument>;
  let receipts: Model<unknown>;
  let users: Model<UserDocument>;
  let createFamilyInvitation: CreateFamilyInvitation;
  const auditEvents: Array<Record<string, unknown>> = [];
  const outboxEvents: Array<Record<string, unknown>> = [];
  const patientId = new Types.ObjectId();
  const contactId = new Types.ObjectId();
  const secondContactId = new Types.ObjectId();

  beforeAll(async () => {
    const uri = new URL(
      process.env.TEST_MONGODB_URI ??
        'mongodb://127.0.0.1:27018/healthcare_family_test?replicaSet=rs0&directConnection=true',
    );
    uri.pathname = `/fc_${randomUUID().replaceAll('-', '')}`;
    testMongoUri = uri.toString();
    const mongo = new MongoClient(uri.toString());
    try {
      await mongo.connect();
      await migrateDatabase(mongo.db());
    } catch (error) {
      const generatedName = uri.pathname.slice(1);
      if (/^fc_[a-f0-9]{32}$/.test(generatedName)) {
        try {
          await mongo.db(generatedName).dropDatabase();
        } catch {
          /* preserve original setup error */
        }
      }
      throw error;
    } finally {
      await mongo.close();
    }
    connection = await createConnection(uri.toString(), {
      autoIndex: true,
      serverSelectionTimeoutMS: 5_000,
    }).asPromise();
    links = connection.model(
      FamilyLink.name,
      FamilyLinkSchema,
    ) as unknown as Model<FamilyLinkDocument>;
    permissions = connection.model(
      FamilyPermission.name,
      FamilyPermissionSchema,
    ) as unknown as Model<FamilyPermissionDocument>;
    receipts = connection.model(
      FamilyCommandReceipt.name,
      FamilyCommandReceiptSchema,
    );
    users = connection.model<UserDocument>(User.name, UserSchema);
    await users.create([
      {
        _id: patientId,
        fullName: 'Synthetic Patient',
        email: 'patient@example.test',
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      {
        _id: contactId,
        fullName: 'Synthetic Contact',
        email: 'contact@example.test',
        phoneNumber: '+84901234567',
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
      },
      {
        _id: secondContactId,
        fullName: 'Synthetic Second Contact',
        email: 'second-contact@example.test',
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    ]);
    const config = {
      get: (key: string) =>
        key === 'FAMILY_COMPANION_ENABLED'
          ? true
          : 'http://localhost:5173/redeem?token=',
    } as never;
    const audits = {
      create: async (events: Array<Record<string, unknown>>) => {
        auditEvents.push(...events);
      },
    } as never;
    const grants = {
      getEffectiveSubscription: async () => ({
        _id: new Types.ObjectId(),
        planSnapshot: { familyLinkLimit: 1 },
      }),
    } as never;
    const outbox = {
      enqueue: async (event: Record<string, unknown>) => {
        outboxEvents.push(event);
      },
    } as never;
    createFamilyInvitation = new CreateFamilyInvitation(
      new MongooseFamilyInvitationCreationStore(
        links,
        users,
        audits,
        grants,
        outbox,
        connection,
      ),
      config,
    );
    familyLinkRepository = new MongooseFamilyLinkRepository(
      links as never,
      permissions as never,
      users as never,
      audits,
      receipts as never,
      outbox,
      connection,
    );
    redeemInvitation = new RedeemFamilyInvitation(
      familyLinkRepository,
      config,
      {
        assertCanTryShortCode: async () => undefined,
      },
    );
    acceptInvitation = new AcceptFamilyInvitation(
      familyLinkRepository,
      config,
      grants,
    );
    expireInvitations = new ExpireFamilyInvitations(
      familyLinkRepository,
      config,
    );
    rejectInvitation = new RejectFamilyInvitation(familyLinkRepository, config);
    changeStatus = new ChangeFamilyLinkStatus(familyLinkRepository, config);
  });

  afterAll(async () => {
    const name = connection?.db?.databaseName;
    if (
      name &&
      /^fc_[a-f0-9]{32}$/.test(name) &&
      new URL(testMongoUri).pathname === `/${name}`
    ) {
      await connection.db!.dropDatabase();
    }
    await connection?.close();
  });

  beforeEach(async () => {
    await permissions.deleteMany({});
    await links.deleteMany({});
    await receipts.deleteMany({});
    auditEvents.length = 0;
    outboxEvents.length = 0;
  });

  it('rehearses the sharing migration a second time and verifies the schema manifest', async () => {
    const mongo = new MongoClient(testMongoUri);
    try {
      await mongo.connect();
      await applyFamilyHealthSharing(mongo.db());
      const result = await verifyDatabase(
        mongo.db(),
        FAMILY_HEALTH_SHARING_VERSION,
      );
      expect(result.currentVersion).toBeGreaterThanOrEqual(
        FAMILY_HEALTH_SHARING_VERSION,
      );
    } finally {
      await mongo.close();
    }
  }, 120_000);

  it('stores sharing, audit and outbox atomically and handles idempotent retries', async () => {
    const sharingModel =
      connection.models[FamilyHealthMetricSharing.name] ??
      connection.model(
        FamilyHealthMetricSharing.name,
        FamilyHealthMetricSharingSchema,
      );
    const auditModel =
      connection.models[AuditLog.name] ??
      connection.model(AuditLog.name, AuditLogSchema);
    const outboxModel =
      connection.models[OutboxEvent.name] ??
      connection.model(OutboxEvent.name, OutboxEventSchema);
    const repository = new MongooseFamilyHealthMetricSharingRepository(
      links as never,
      sharingModel as never,
      auditModel as never,
      outboxModel as never,
      new OutboxService(outboxModel as never),
      connection,
    );
    const link = await links.create({
      patientId,
      familyUserId: contactId,
      status: 'active',
      invitationVersion: 1,
      invitationDelivery: 'selected_contact',
      invitedAt: new Date(),
      invitationExpiresAt: new Date(Date.now() + 10000),
      permissions: [],
    });
    const request = {
      patientId: String(patientId),
      familyLinkId: String(link._id),
      scope: { scope: 'all' as const },
      consentVersion: 'family-health-metric-sharing.v1',
      idempotencyKey: randomUUID(),
      now: new Date(),
    };
    expect(await repository.grant(request)).toEqual({ revision: 1 });
    expect(await repository.grant(request)).toEqual({ revision: 1 });
    const notificationModel =
      connection.models[Notification.name] ??
      connection.model(Notification.name, NotificationSchema);
    const outboxService = new OutboxService(outboxModel as never);
    const notificationService = new NotificationsService(
      notificationModel as never,
      outboxService,
      connection,
    );
    const delivery = new FamilyHealthSharingNotificationService(
      links as never,
      sharingModel as never,
      notificationService,
    );
    const event = await outboxModel
      .findOne({
        aggregateId: link._id,
        eventType: 'family.health-metric-sharing.changed.v1',
      })
      .exec();
    expect(event).toBeTruthy();
    await outboxModel.updateOne(
      { _id: event!._id },
      { $set: { status: 'processing' } },
    );
    const worker = Object.create(OutboxWorkerService.prototype) as any;
    worker.outbox = outboxService;
    worker.familyCompanionEnabled = true;
    worker.careAutomationEnabled = true;
    worker.familyHealthSharingNotification = delivery;
    await worker.deliverEvent(String(event!._id), 0, 1);
    await delivery.deliver({
      familyLinkId: String(link._id),
      invitationVersion: 1,
      revision: 1,
    });
    expect(
      await notificationModel.countDocuments({
        userId: contactId,
        idempotencyKey: `family.health-sharing.notification.${String(link._id)}.1.1`,
      }),
    ).toBe(1);
    expect((await outboxModel.findById(event!._id).lean())?.status).toBe(
      'delivered',
    );
    await expect(
      repository.grant({
        ...request,
        scope: { scope: 'selected', metricTypes: ['weight'] },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        status: 'active',
      }),
    ).toBe(1);
    expect(
      await auditModel.countDocuments({
        entityId: link._id,
        action: 'family_health_metric_sharing_granted',
      }),
    ).toBe(1);
    expect(
      await outboxModel.countDocuments({
        aggregateId: link._id,
        eventType: 'family.health-metric-sharing.changed.v1',
      }),
    ).toBe(1);
    const metricModel =
      connection.models[HealthMetric.name] ??
      connection.model(HealthMetric.name, HealthMetricSchema);
    await metricModel.create({
      meta: { patientId, metricType: 'weight', unit: 'kg' },
      values: { value: 70 },
      source: 'manual',
      validationStatus: 'valid',
      recordedAt: new Date('2020-01-01T00:00:00Z'),
    });
    const metrics = new MongooseSharedHealthMetricReader(
      metricModel as never,
      new HealthMetricQueryService(metricModel as never),
    );
    const reads = new ReadFamilyHealthMetrics(
      repository,
      metrics,
      {
        getEffectiveSubscription: async () => ({
          planSnapshot: { familyLinkLimit: 1 },
        }),
      } as never,
      { get: () => true } as never,
    );
    const trend = await reads.read(
      String(contactId),
      String(link._id),
      'trend',
      { metricType: 'weight', period: 'all', limit: 10 },
    );
    expect(trend.data).toMatchObject({
      items: [{ metricType: 'weight', values: { value: 70 } }],
    });
    expect(JSON.stringify(trend)).not.toContain('patientId');
    const summary = await reads.read(
      String(contactId),
      String(link._id),
      'summary',
      { metricType: 'weight', period: 'all', limit: 10 },
    );
    expect(summary.data).toMatchObject({ count: 1, average: 70 });
    await expect(
      reads.read(String(patientId), String(link._id), 'trend', {
        metricType: 'weight',
        period: 'all',
        limit: 10,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const httpModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [FamilyHealthMetricsController],
      providers: [
        {
          provide: GrantFamilyHealthMetricSharing,
          useValue: new GrantFamilyHealthMetricSharing(
            repository,
            metrics,
            { get: () => true } as never,
            {
              getEffectiveSubscription: async () => ({
                planSnapshot: { familyLinkLimit: 1 },
              }),
            } as never,
          ),
        },
        {
          provide: RevokeFamilyHealthMetricSharing,
          useValue: new RevokeFamilyHealthMetricSharing(repository, {
            get: () => true,
          } as never),
        },
        { provide: ReadFamilyHealthMetrics, useValue: reads },
        {
          provide: JwtStrategy,
          useValue: new JwtStrategy(users, {
            getOrThrow: () => 'synthetic-test-secret-only',
          } as never),
        },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();
    const app = httpModule.createNestApplication();
    await app.init();
    try {
      const jwt = new JwtService({ secret: 'synthetic-test-secret-only' });
      const contactToken = jwt.sign({
        sub: String(contactId),
        role: UserRole.PATIENT,
      });
      const patientToken = jwt.sign({
        sub: String(patientId),
        role: UserRole.PATIENT,
      });
      const response = await supertest(app.getHttpServer())
        .get(`/family-links/${String(link._id)}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'all', limit: 10 })
        .expect(200);
      expect(response.body.data.items).toHaveLength(1);
      await supertest(app.getHttpServer())
        .get(`/family-links/${String(link._id)}/health-metrics/trend`)
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ metricType: 'weight', limit: 10 })
        .expect(403);
      await supertest(app.getHttpServer())
        .get(`/family-links/${String(link._id)}/health-metrics/trend`)
        .query({ metricType: 'weight', period: 'all' })
        .expect(401);
      await supertest(app.getHttpServer())
        .put(`/family-links/${String(link._id)}/health-metric-sharing`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', request.idempotencyKey)
        .send({ scope: 'all', consentVersion: request.consentVersion })
        .expect(200);
      await supertest(app.getHttpServer())
        .put(`/family-links/${String(link._id)}/health-metric-sharing`)
        .set('Authorization', `Bearer ${contactToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ scope: 'all', consentVersion: request.consentVersion })
        .expect(404);
    } finally {
      await app.close();
    }
    const failingRepository = new MongooseFamilyHealthMetricSharingRepository(
      links as never,
      sharingModel as never,
      auditModel as never,
      outboxModel as never,
      {
        enqueue: async () => {
          throw new Error('synthetic outbox failure');
        },
      } as never,
      connection,
    );
    await expect(
      failingRepository.grant({
        ...request,
        idempotencyKey: randomUUID(),
        scope: { scope: 'selected', metricTypes: ['weight'] },
      }),
    ).rejects.toThrow('synthetic outbox failure');
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        status: 'active',
        revision: 1,
      }),
    ).toBe(1);
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        revision: 2,
      }),
    ).toBe(0);
    expect(
      await auditModel.countDocuments({
        entityId: link._id,
        action: 'family_health_metric_sharing_granted',
      }),
    ).toBe(1);
    await repository.revoke({
      patientId: String(patientId),
      familyLinkId: String(link._id),
      idempotencyKey: randomUUID(),
      now: new Date(),
    });
    await expect(
      reads.read(String(contactId), String(link._id), 'trend', {
        metricType: 'weight',
        limit: 10,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        status: 'active',
      }),
    ).toBe(0);
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        status: 'revoked',
      }),
    ).toBe(1);
    const concurrentRequest = {
      ...request,
      idempotencyKey: randomUUID(),
      now: new Date(),
    };
    const duplicates = await Promise.all([
      repository.grant(concurrentRequest),
      repository.grant(concurrentRequest),
    ]);
    expect(duplicates[0]).toEqual(duplicates[1]);
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        revision: duplicates[0].revision,
      }),
    ).toBe(1);
    await Promise.allSettled([
      repository.grant({ ...request, idempotencyKey: randomUUID() }),
      changeStatus.execute(
        String(patientId),
        String(link._id),
        'revoke',
        undefined,
        randomUUID(),
      ),
    ]);
    expect((await links.findById(link._id).lean())?.status).toBe('revoked');
    expect(
      await sharingModel.countDocuments({
        familyLinkId: link._id,
        status: 'active',
      }),
    ).toBe(0);
    const raceLink = await links.create({
      patientId,
      familyUserId: secondContactId,
      status: 'active',
      invitationVersion: 1,
      idempotencyKey: randomUUID(),
      invitationDelivery: 'selected_contact',
      invitedAt: new Date(),
      invitationExpiresAt: new Date(Date.now() + 10_000),
      permissions: [],
    });
    await repository.grant({
      ...request,
      familyLinkId: String(raceLink._id),
      idempotencyKey: randomUUID(),
      now: new Date(),
    });
    let markFetchStarted: () => void = () => undefined;
    let finishFetch: () => void = () => undefined;
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve;
    });
    const fetchGate = new Promise<void>((resolve) => {
      finishFetch = resolve;
    });
    const delayedMetrics = {
      supportedTypes: () => ['weight'],
      summary: async () => ({ count: 0 }),
      trend: async () => {
        markFetchStarted();
        await fetchGate;
        return { items: [], nextCursor: null };
      },
    };
    const delayedRead = new ReadFamilyHealthMetrics(
      repository,
      delayedMetrics as never,
      {
        getEffectiveSubscription: async () => ({
          planSnapshot: { familyLinkLimit: 1 },
        }),
      } as never,
      { get: () => true } as never,
    ).read(String(secondContactId), String(raceLink._id), 'trend', {
      metricType: 'weight',
      limit: 10,
    });
    await fetchStarted;
    await repository.revoke({
      patientId: String(patientId),
      familyLinkId: String(raceLink._id),
      idempotencyKey: randomUUID(),
      now: new Date(),
    });
    finishFetch();
    await expect(delayedRead).rejects.toMatchObject({ status: 403 });
    expect(
      await auditModel.countDocuments({
        entityId: raceLink._id,
        action: 'family_health_metric_trend_read',
      }),
    ).toBe(0);
  }, 120_000);

  it('runs invitation, sharing, pause, resume and revoke through JWT-protected HTTP', async () => {
    const sharingModel =
      connection.models[FamilyHealthMetricSharing.name] ??
      connection.model(
        FamilyHealthMetricSharing.name,
        FamilyHealthMetricSharingSchema,
      );
    const auditModel =
      connection.models[AuditLog.name] ??
      connection.model(AuditLog.name, AuditLogSchema);
    const outboxModel =
      connection.models[OutboxEvent.name] ??
      connection.model(OutboxEvent.name, OutboxEventSchema);
    const metricModel =
      connection.models[HealthMetric.name] ??
      connection.model(HealthMetric.name, HealthMetricSchema);
    await metricModel.deleteMany({ 'meta.patientId': patientId });
    const outbox = new OutboxService(outboxModel as never);
    const subscription = {
      getEffectiveSubscription: async () => ({
        planSnapshot: { familyLinkLimit: 1 },
      }),
    };
    const config = {
      get: (key: string) =>
        key === 'FAMILY_COMPANION_ENABLED'
          ? true
          : 'http://localhost/redeem?token=',
    };
    const linkRepo = new MongooseFamilyLinkRepository(
      links as never,
      permissions as never,
      users as never,
      auditModel as never,
      receipts as never,
      outbox,
      connection,
    );
    const sharingRepo = new MongooseFamilyHealthMetricSharingRepository(
      links as never,
      sharingModel as never,
      auditModel as never,
      outboxModel as never,
      outbox,
      connection,
    );
    const metrics = new MongooseSharedHealthMetricReader(
      metricModel as never,
      new HealthMetricQueryService(metricModel as never),
    );
    const create = new CreateFamilyInvitation(
      new MongooseFamilyInvitationCreationStore(
        links as never,
        users as never,
        auditModel as never,
        subscription as never,
        outbox,
        connection,
      ),
      config as never,
    );
    const httpModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [FamilyLinksController, FamilyHealthMetricsController],
      providers: [
        { provide: CreateFamilyInvitation, useValue: create },
        {
          provide: RedeemFamilyInvitation,
          useValue: new RedeemFamilyInvitation(linkRepo, config as never, {
            assertCanTryShortCode: async () => undefined,
          }),
        },
        {
          provide: AcceptFamilyInvitation,
          useValue: new AcceptFamilyInvitation(
            linkRepo,
            config as never,
            subscription as never,
          ),
        },
        {
          provide: RejectFamilyInvitation,
          useValue: new RejectFamilyInvitation(linkRepo, config as never),
        },
        {
          provide: ChangeFamilyLinkStatus,
          useValue: new ChangeFamilyLinkStatus(linkRepo, config as never),
        },
        {
          provide: UpdateFamilyReminderPermissions,
          useValue: new UpdateFamilyReminderPermissions(
            linkRepo,
            config as never,
          ),
        },
        {
          provide: RegenerateFamilyInvitationArtifacts,
          useValue: new RegenerateFamilyInvitationArtifacts(
            linkRepo,
            config as never,
          ),
        },
        { provide: ReadFamilyLinks, useValue: {} },
        {
          provide: GrantFamilyHealthMetricSharing,
          useValue: new GrantFamilyHealthMetricSharing(
            sharingRepo,
            metrics,
            config as never,
            subscription as never,
          ),
        },
        {
          provide: RevokeFamilyHealthMetricSharing,
          useValue: new RevokeFamilyHealthMetricSharing(
            sharingRepo,
            config as never,
          ),
        },
        {
          provide: ReadFamilyHealthMetrics,
          useValue: new ReadFamilyHealthMetrics(
            sharingRepo,
            metrics,
            subscription as never,
            config as never,
          ),
        },
        {
          provide: JwtStrategy,
          useValue: new JwtStrategy(users, {
            getOrThrow: () => 'synthetic-test-secret-only',
          } as never),
        },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();
    const app = httpModule.createNestApplication();
    await app.init();
    const jwt = new JwtService({ secret: 'synthetic-test-secret-only' });
    const patientToken = jwt.sign({
      sub: String(patientId),
      role: UserRole.PATIENT,
    });
    const contactToken = jwt.sign({
      sub: String(contactId),
      role: UserRole.PATIENT,
    });
    try {
      const invitation = await supertest(app.getHttpServer())
        .post('/family-links')
        .set('Authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ contactUserId: String(contactId) })
        .expect(201);
      const id = invitation.body.data.link.id as string;
      await supertest(app.getHttpServer())
        .post('/family-links/redeem')
        .set('Authorization', `Bearer ${contactToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ shortCode: invitation.body.data.artifacts.shortCode })
        .expect(201);
      await supertest(app.getHttpServer())
        .post(`/family-links/${id}/accept`)
        .set('Authorization', `Bearer ${contactToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ consentVersion: 'family-companion.v1', permissions: [] })
        .expect(201);
      await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'all' })
        .expect(403);
      await supertest(app.getHttpServer())
        .put(`/family-links/${id}/health-metric-sharing`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          scope: 'selected',
          metricTypes: ['weight'],
          consentVersion: 'family-health-metric-sharing.v1',
        })
        .expect(200);
      const emptyTrend = await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'all' })
        .expect(200);
      expect(emptyTrend.body.data).toMatchObject({
        items: [],
        nextCursor: null,
        window: { period: 'all', timeZone: 'Asia/Ho_Chi_Minh' },
      });
      await metricModel.create({
        meta: { patientId, metricType: 'weight', unit: 'kg' },
        values: { value: 65 },
        source: 'manual',
        validationStatus: 'valid',
        recordedAt: new Date('2019-01-01T00:00:00Z'),
      });
      const weekStart = new Date('2024-11-17T17:00:00.000Z');
      const weekEnd = new Date('2024-11-24T17:00:00.000Z');
      await metricModel.create([
        {
          meta: { patientId, metricType: 'weight', unit: 'kg' },
          values: { value: 66 },
          source: 'manual',
          validationStatus: 'valid',
          recordedAt: weekStart,
        },
        {
          meta: { patientId, metricType: 'weight', unit: 'kg' },
          values: { value: 67 },
          source: 'manual',
          validationStatus: 'valid',
          recordedAt: weekEnd,
        },
      ]);
      const result = await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'week', anchor: '2024-11-20' })
        .expect(200);
      expect(result.body.data.items).toEqual([
        expect.objectContaining({ values: { value: 66 } }),
      ]);
      expect(result.body.data.window).toMatchObject({
        period: 'week',
        timeZone: 'Asia/Ho_Chi_Minh',
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
        boundary: '[start,end)',
      });
      const sameWeekSummary = await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/summary`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'week', anchor: '2024-11-20' })
        .expect(200);
      expect(sameWeekSummary.body.data).toMatchObject({ count: 1, average: 66 });
      await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'heart_rate' })
        .expect(403);
      await supertest(app.getHttpServer())
        .post(`/family-links/${id}/actions/pause`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({})
        .expect(201);
      await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'all' })
        .expect(403);
      await supertest(app.getHttpServer())
        .post(`/family-links/${id}/actions/resume`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({})
        .expect(201);
      await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/summary`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight', period: 'all' })
        .expect(200);
      await supertest(app.getHttpServer())
        .delete(`/family-links/${id}/health-metric-sharing`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('Idempotency-Key', randomUUID())
        .expect(200);
      await supertest(app.getHttpServer())
        .get(`/family-links/${id}/health-metrics/trend`)
        .set('Authorization', `Bearer ${contactToken}`)
        .query({ metricType: 'weight' })
        .expect(403);
    } finally {
      await app.close();
    }
  }, 120_000);

  it('serializes concurrent accepts so active links cannot exceed the invitation limit', async () => {
    const first = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      randomUUID(),
    );
    const second = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      randomUUID(),
    );
    const firstData = first.data as {
      link: { id: string };
      artifacts: { shortCode: string };
    };
    const secondData = second.data as {
      link: { id: string };
      artifacts: { shortCode: string };
    };
    await redeemInvitation.execute(
      String(contactId),
      {
        shortCode: firstData.artifacts.shortCode,
      },
      'redeem-limit-first',
    );
    await redeemInvitation.execute(
      String(secondContactId),
      {
        shortCode: secondData.artifacts.shortCode,
      },
      'redeem-limit-second',
    );
    const outcomes = await Promise.allSettled([
      acceptInvitation.execute(
        String(contactId),
        firstData.link.id,
        { consentVersion: 'family-companion.v1', permissions: [] },
        randomUUID(),
      ),
      acceptInvitation.execute(
        String(secondContactId),
        secondData.link.id,
        { consentVersion: 'family-companion.v1', permissions: [] },
        randomUUID(),
      ),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await links.countDocuments({ patientId, status: 'active' })).toBe(1);
  });

  it('checks the current subscription when accepting an older pending invitation', async () => {
    const invitation = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      randomUUID(),
    );
    const id = (invitation.data as { link: { id: string } }).link.id;
    const afterDowngrade = new AcceptFamilyInvitation(
      familyLinkRepository,
      { get: () => true } as never,
      {
        getEffectiveSubscription: async () => ({
          planSnapshot: { familyLinkLimit: 0 },
        }),
      } as never,
    );
    await expect(
      afterDowngrade.execute(
        String(contactId),
        id,
        { consentVersion: 'family-companion.v1', permissions: [] },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect((await links.findById(id).lean())?.status).toBe('pending');
  });

  it('creates a direct-lookup invitation with reveal-once artifacts and redacted persistence', async () => {
    const result = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      'idempotency-direct-1',
    );
    const artifacts = (
      result.data as { artifacts: { shareLink: string; shortCode: string } }
    ).artifacts;
    expect(
      (result.data as { link: Record<string, unknown> }).link.familyUserId,
    ).toBeUndefined();
    expect(artifacts.shareLink).not.toContain('contact@example.test');
    expect(artifacts.shareLink).not.toContain(String(contactId));
    expect(artifacts.shortCode).toMatch(/^\d{6}$/);
    const stored = await links
      .findById((result.data as { link: { id: string } }).link.id)
      .select('+invitationTokenHash +shortCodeHash')
      .lean();
    expect(stored?.familyUserId?.toString()).toBe(contactId.toString());
    await expect(
      createFamilyInvitation.execute(
        String(patientId),
        { contactUserId: String(secondContactId) },
        'idempotency-direct-1',
      ),
    ).rejects.toMatchObject({
      response: { message: 'IDEMPOTENCY_KEY_CONFLICT' },
    });
    expect(stored?.invitationTokenHash).not.toBe(artifacts.shareLink);
    expect(stored?.shortCodeHash).not.toBe(artifacts.shortCode);
    expect(JSON.stringify(auditEvents)).not.toContain(artifacts.shortCode);
    expect(JSON.stringify(outboxEvents)).not.toContain(artifacts.shortCode);
  });

  it('creates an invitation using the selected eligible Patient ID', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      'idempotency-selected-contact',
    );
    const stored = await links
      .findById((created.data as { link: { id: string } }).link.id)
      .lean();
    expect(stored?.familyUserId?.toString()).toBe(contactId.toString());
    await expect(
      createFamilyInvitation.execute(
        String(patientId),
        { contactUserId: String(new Types.ObjectId()) },
        'idempotency-ineligible-contact',
      ),
    ).rejects.toMatchObject({
      response: { message: 'FAMILY_CONTACT_NOT_ELIGIBLE' },
    });
  });

  it('replays concurrent invitation creation once without revealing artifacts twice', async () => {
    const idempotencyKey = randomUUID();
    const command = { share: true };
    const [first, retry] = await Promise.all([
      createFamilyInvitation.execute(
        String(patientId),
        command,
        idempotencyKey,
      ),
      createFamilyInvitation.execute(
        String(patientId),
        command,
        idempotencyKey,
      ),
    ]);
    const responses = [first, retry] as Array<{
      statusCode: number;
      data: {
        link: { id: string };
        artifacts?: { shortCode?: string; shareLink?: string };
      };
    }>;
    expect(responses[0].data.link.id).toBe(responses[1].data.link.id);
    expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 201,
    ]);
    expect(
      responses.filter(({ data }) => data.artifacts?.shortCode),
    ).toHaveLength(1);
    expect(
      await links.countDocuments({
        _id: responses[0].data.link.id,
        patientId,
      }),
    ).toBe(1);
    expect(
      auditEvents.filter(
        (event) => event.action === 'family_invitation_created',
      ),
    ).toHaveLength(1);
    expect(
      outboxEvents.filter(
        (event) => event.eventType === 'family.invitation.created.v1',
      ),
    ).toHaveLength(1);
  });

  it('redeems and accepts an unclaimed invitation, creating a permission snapshot', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      'idempotency-unclaimed-1',
    );
    const data = created.data as {
      link: { id: string };
      artifacts: { shareLink: string };
    };
    const token = decodeURIComponent(
      data.artifacts.shareLink.split('token=')[1],
    );
    const redeemed = await redeemInvitation.execute(
      String(contactId),
      {
        invitationToken: token,
      },
      'redeem-unclaimed',
    );
    await expect(
      redeemInvitation.execute(
        String(contactId),
        { invitationToken: token },
        'redeem-unclaimed',
      ),
    ).resolves.toEqual(redeemed);
    await expect(
      redeemInvitation.execute(
        String(contactId),
        { shortCode: '100001' },
        'redeem-unclaimed',
      ),
    ).rejects.toMatchObject({
      response: { message: 'IDEMPOTENCY_KEY_CONFLICT' },
    });
    expect(
      (redeemed.data as { familyUserId?: string }).familyUserId,
    ).toBeUndefined();
    const accepted = await acceptInvitation.execute(
      String(contactId),
      data.link.id,
      {
        consentVersion: 'family-companion.v1',
        permissions: ['weekly_progress'],
      },
      'idempotency-accept-1',
    );
    await expect(
      acceptInvitation.execute(
        String(contactId),
        data.link.id,
        {
          consentVersion: 'family-companion.v1',
          permissions: ['weekly_progress'],
        },
        'idempotency-accept-1',
      ),
    ).resolves.toEqual(accepted);
    await expect(
      acceptInvitation.execute(
        String(contactId),
        data.link.id,
        { consentVersion: 'family-companion.v1', permissions: [] },
        'idempotency-accept-1',
      ),
    ).rejects.toMatchObject({
      response: { message: 'IDEMPOTENCY_KEY_CONFLICT' },
    });
    const receipt = await receipts
      .findOne({ operation: 'accept_invitation' })
      .lean();
    expect(JSON.stringify(receipt)).not.toContain(token);
    const active = await links.findById(data.link.id).lean();
    expect(active?.status).toBe('active');
    expect(active?.familyUserId?.toString()).toBe(contactId.toString());
    expect(
      await permissions.countDocuments({
        familyLinkId: new Types.ObjectId(data.link.id),
        status: 'active',
      }),
    ).toBe(1);
    expect(
      outboxEvents.filter(
        (event) => event.eventType === 'family.link.accepted.v1',
      ),
    ).toHaveLength(1);
  });

  it('replays concurrent status commands once and rejects key reuse with changed input', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      'status-replay-create',
    );
    const linkId = (created.data as { link: { id: string } }).link.id;
    await acceptInvitation.execute(
      String(contactId),
      linkId,
      { consentVersion: 'family-companion.v1', permissions: [] },
      'status-replay-accept',
    );
    const results = await Promise.all([
      changeStatus.execute(
        String(patientId),
        linkId,
        'pause',
        'temporary',
        'status-replay-key',
      ),
      changeStatus.execute(
        String(patientId),
        linkId,
        'pause',
        'temporary',
        'status-replay-key',
      ),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      outboxEvents.filter(
        (event) => event.eventType === 'family.link.pause.v1',
      ),
    ).toHaveLength(1);
    await expect(
      changeStatus.execute(
        String(patientId),
        linkId,
        'pause',
        'different',
        'status-replay-key',
      ),
    ).rejects.toMatchObject({
      response: { message: 'IDEMPOTENCY_KEY_CONFLICT' },
    });
  });

  it('enforces the subscription snapshot limit without trusting client input', async () => {
    const first = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      'idempotency-limit-first',
    );
    const firstData = first.data as {
      link: { id: string };
      artifacts: { shareLink: string };
    };
    const firstToken = decodeURIComponent(
      firstData.artifacts.shareLink.split('token=')[1],
    );
    await redeemInvitation.execute(
      String(contactId),
      {
        invitationToken: firstToken,
      },
      'redeem-limit-link',
    );
    await acceptInvitation.execute(
      String(contactId),
      firstData.link.id,
      { consentVersion: 'family-companion.v1', permissions: [] },
      'idempotency-limit-accept',
    );
    expect(await links.countDocuments({ patientId, status: 'active' })).toBe(1);
    await expect(
      createFamilyInvitation.execute(
        String(patientId),
        { share: true },
        'idempotency-over-limit-1',
      ),
    ).rejects.toMatchObject({
      response: { message: 'FAMILY_LINK_LIMIT_REACHED' },
    });
  });

  it('expires pending invitations through the worker-facing application port', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      'idempotency-expiry-1',
    );
    const id = (created.data as { link: { id: string } }).link.id;
    await links.updateOne(
      { _id: id },
      { $set: { invitationExpiresAt: new Date(Date.now() - 1_000) } },
    );
    await expect(expireInvitations.execute()).resolves.toBe(1);
    expect((await links.findById(id).lean())?.status).toBe('expired');
    expect(
      outboxEvents.some(
        (event) => event.eventType === 'family.invitation.expired.v1',
      ),
    ).toBe(true);
  });

  it('reuses a terminal selected-contact link with a new invitation version', async () => {
    const first = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      'idempotency-reinvite-first',
    );
    const firstId = (first.data as { link: { id: string } }).link.id;
    await links.updateOne(
      { _id: firstId },
      { $set: { status: 'revoked', revokedAt: new Date() } },
    );
    const second = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      'idempotency-reinvite-second',
    );
    const secondLink = (
      second.data as {
        link: { id: string; invitationVersion: number; status: string };
      }
    ).link;
    expect(secondLink.id).toBe(firstId);
    expect(secondLink.invitationVersion).toBe(2);
    expect(secondLink.status).toBe('pending');
  });

  it('does not replay an accepted command into a later invitation version', async () => {
    const first = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      randomUUID(),
    );
    const firstLink = (first.data as { link: { id: string } }).link;
    const acceptKey = randomUUID();
    const acceptCommand = {
      consentVersion: 'family-companion.v1',
      permissions: ['weekly_progress'] as const,
    };
    await acceptInvitation.execute(
      String(contactId),
      firstLink.id,
      { ...acceptCommand, permissions: [...acceptCommand.permissions] },
      acceptKey,
    );

    await links.updateOne(
      { _id: firstLink.id },
      { $set: { status: 'revoked', revokedAt: new Date() } },
    );
    const second = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      randomUUID(),
    );
    expect(
      (second.data as { link: { invitationVersion: number } }).link
        .invitationVersion,
    ).toBe(2);

    await expect(
      acceptInvitation.execute(
        String(contactId),
        firstLink.id,
        { ...acceptCommand, permissions: [...acceptCommand.permissions] },
        acceptKey,
      ),
    ).rejects.toMatchObject({
      response: { message: 'IDEMPOTENCY_KEY_CONFLICT' },
    });
    expect((await links.findById(firstLink.id).lean())?.status).toBe('pending');
  });

  it('consumes a short code on first redeem', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      'idempotency-code-once',
    );
    const data = created.data as { artifacts: { shortCode: string } };
    await redeemInvitation.execute(
      String(contactId),
      {
        shortCode: data.artifacts.shortCode,
      },
      'redeem-expired-code-first',
    );
    await expect(
      redeemInvitation.execute(
        String(contactId),
        {
          shortCode: data.artifacts.shortCode,
        },
        'redeem-expired-code-retry',
      ),
    ).rejects.toMatchObject({
      response: { message: 'INVITATION_NOT_FOUND_OR_EXPIRED' },
    });
  });

  it('consumes a short code atomically under concurrent redemption', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      randomUUID(),
    );
    const code = (created.data as { artifacts: { shortCode: string } })
      .artifacts.shortCode;
    const outcomes = await Promise.allSettled([
      redeemInvitation.execute(
        String(contactId),
        { shortCode: code },
        'redeem-race-one',
      ),
      redeemInvitation.execute(
        String(secondContactId),
        { shortCode: code },
        'redeem-race-two',
      ),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
  });

  it('invalidates a previous redemption when invitation artifacts are regenerated', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      randomUUID(),
    );
    const data = created.data as {
      link: { id: string };
      artifacts: { shortCode: string };
    };
    await redeemInvitation.execute(
      String(contactId),
      {
        shortCode: data.artifacts.shortCode,
      },
      'redeem-regenerate-old',
    );
    const regenerate = new RegenerateFamilyInvitationArtifacts(
      familyLinkRepository,
      {
        get: (key: string) =>
          key === 'FAMILY_COMPANION_ENABLED'
            ? true
            : 'http://localhost/redeem?token=',
      } as never,
    );
    const regenerateKey = randomUUID();
    const updated = await regenerate.execute(
      String(patientId),
      data.link.id,
      regenerateKey,
    );
    const replay = await regenerate.execute(
      String(patientId),
      data.link.id,
      regenerateKey,
    );
    expect(replay.data.artifacts).toEqual({
      familyLinkId: data.link.id,
      revealOnce: true,
      available: false,
    });
    expect(replay.data.link.invitationVersion).toBe(
      updated.data.link.invitationVersion,
    );
    await expect(
      acceptInvitation.execute(
        String(contactId),
        data.link.id,
        { consentVersion: 'family-companion.v1', permissions: [] },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await redeemInvitation.execute(
      String(contactId),
      {
        shortCode: updated.data.artifacts.shortCode,
      },
      'redeem-regenerate-new',
    );
    await expect(
      acceptInvitation.execute(
        String(contactId),
        data.link.id,
        { consentVersion: 'family-companion.v1', permissions: [] },
        randomUUID(),
      ),
    ).resolves.toMatchObject({ statusCode: 200 });
  });

  it('allows the redeemer of a shared invitation to decline it', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { share: true },
      'shared-decline-create',
    );
    const data = created.data as {
      link: { id: string };
      artifacts: { shortCode: string };
    };
    await redeemInvitation.execute(
      String(contactId),
      {
        shortCode: data.artifacts.shortCode,
      },
      'redeem-decline',
    );
    await rejectInvitation.execute(
      String(contactId),
      data.link.id,
      undefined,
      'shared-decline',
    );
    expect((await links.findById(data.link.id).lean())?.status).toBe(
      'declined',
    );
  });

  it('keeps consent during pause and resume, and revokes it on link revocation', async () => {
    const created = await createFamilyInvitation.execute(
      String(patientId),
      { contactUserId: String(contactId) },
      'pause-resume-create',
    );
    const id = (created.data as { link: { id: string } }).link.id;
    await acceptInvitation.execute(
      String(contactId),
      id,
      {
        consentVersion: 'family-companion.v1',
        permissions: ['weekly_progress'],
      },
      'pause-resume-accept',
    );
    await changeStatus.execute(
      String(patientId),
      id,
      'pause',
      undefined,
      'pause-link',
    );
    expect(
      await permissions.countDocuments({
        familyLinkId: new Types.ObjectId(id),
        status: 'active',
      }),
    ).toBe(1);
    await changeStatus.execute(
      String(patientId),
      id,
      'resume',
      undefined,
      'resume-link',
    );
    expect(
      await permissions.countDocuments({
        familyLinkId: new Types.ObjectId(id),
        status: 'active',
      }),
    ).toBe(1);
    await changeStatus.execute(
      String(patientId),
      id,
      'revoke',
      undefined,
      'revoke-link',
    );
    expect(
      await permissions.countDocuments({
        familyLinkId: new Types.ObjectId(id),
        status: 'active',
      }),
    ).toBe(0);
  });
});
