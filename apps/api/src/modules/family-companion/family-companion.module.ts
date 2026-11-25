import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BillingModule } from '../billing/billing.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { UsersModule } from '../users/users.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HealthTrackingModule } from '../health-tracking/health-tracking.module';
import { ChronicCareModule } from '../chronic-care/chronic-care.module';
import {
  OutboxEvent,
  OutboxEventSchema,
} from '../../infrastructure/outbox/entities/outbox-event.entity';
import { FAMILY_HEALTH_METRIC_SHARING_REPOSITORY } from './application/ports/family-health-metric-sharing.repository';
import { MongooseFamilyHealthMetricSharingRepository } from './infrastructure/mongoose/mongoose-family-health-metric-sharing.repository';
import { GrantFamilyHealthMetricSharing } from './application/use-cases/grant-family-health-metric-sharing.use-case';
import { RevokeFamilyHealthMetricSharing } from './application/use-cases/revoke-family-health-metric-sharing.use-case';
import { ReadFamilyHealthMetrics } from './application/queries/read-family-health-metrics';
import { FamilyHealthMetricsController } from './presentation/controllers/family-health-metrics.controller';
import { User, UserSchema } from '../users/public-api';
import {
  FamilyLink,
  FamilyLinkSchema,
} from './infrastructure/mongoose/family-link.schema';
import {
  FamilyPermission,
  FamilyPermissionSchema,
} from './infrastructure/mongoose/family-permission.schema';
import {
  FamilyReminder,
  FamilyReminderSchema,
} from './infrastructure/mongoose/family-reminder.schema';
import { CreateFamilyInvitation } from './application/use-cases/create-family-invitation.use-case';
import { AcceptFamilyInvitation } from './application/use-cases/accept-family-invitation.use-case';
import { RejectFamilyInvitation } from './application/use-cases/reject-family-invitation.use-case';
import { RedeemFamilyInvitation } from './application/use-cases/redeem-family-invitation.use-case';
import { ChangeFamilyLinkStatus } from './application/use-cases/change-family-link-status.use-case';
import { UpdateFamilyReminderPermissions } from './application/use-cases/update-family-reminder-permissions.use-case';
import { RegenerateFamilyInvitationArtifacts } from './application/use-cases/regenerate-family-invitation-artifacts.use-case';
import { ExpireFamilyInvitations } from './application/use-cases/expire-family-invitations.use-case';
import { FAMILY_INVITATION_ATTEMPT_LIMITER } from './application/ports/family-invitation-attempt-limiter.port';
import { RedisFamilyInvitationAttemptLimiter } from './infrastructure/security/redis-family-invitation-attempt-limiter';
import { FAMILY_LINK_REPOSITORY } from './application/ports/family-link.repository';
import { MongooseFamilyLinkRepository } from './infrastructure/mongoose/mongoose-family-link.repository';
import { FAMILY_INVITATION_CREATION_STORE } from './application/ports/family-invitation-creation.port';
import { MongooseFamilyInvitationCreationStore } from './infrastructure/mongoose/mongoose-family-invitation-creation.store';
import { ReadFamilyLinks } from './application/queries/read-family-links';
import { FAMILY_LINK_READ_REPOSITORY } from './application/ports/family-link-read.repository';
import { MongooseFamilyLinkReadRepository } from './infrastructure/mongoose/mongoose-family-link-read.repository';
import { ScheduleFamilyReminders } from './application/use-cases/schedule-family-reminders.use-case';
import { DeliverFamilyReminder } from './application/use-cases/deliver-family-reminder.use-case';
import { FAMILY_REMINDER_DELIVERY_STORE } from './application/ports/family-reminder-delivery.store';
import { MongooseFamilyReminderDeliveryStore } from './infrastructure/mongoose/mongoose-family-reminder-delivery.store';
import { PATIENT_TASK_REMINDER_OUTBOX } from './application/ports/patient-task-reminder-outbox.port';
import { PatientTaskReminderOutboxAdapter } from './infrastructure/outbox/patient-task-reminder-outbox.adapter';
import { FamilyHealthSharingNotificationService } from './infrastructure/outbox/family-health-sharing-notification.service';
import {
  FamilyHealthMetricSharing,
  FamilyHealthMetricSharingSchema,
} from './infrastructure/mongoose/family-health-metric-sharing.schema';
import {
  FamilyCommandReceipt,
  FamilyCommandReceiptSchema,
} from './infrastructure/mongoose/family-command-receipt.schema';
import {
  FamilyReminderQuota,
  FamilyReminderQuotaSchema,
} from './infrastructure/mongoose/family-reminder-quota.schema';
import {
  FamilyLinksController,
  AdminFamilyLinksController,
} from './presentation/controllers/family-links.controller';

@Module({
  imports: [
    BillingModule,
    PlatformAuditModule,
    UsersModule,
    OutboxModule,
    NotificationsModule,
    HealthTrackingModule,
    ChronicCareModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: OutboxEvent.name, schema: OutboxEventSchema },
      { name: FamilyLink.name, schema: FamilyLinkSchema },
      { name: FamilyPermission.name, schema: FamilyPermissionSchema },
      { name: FamilyReminder.name, schema: FamilyReminderSchema },
      {
        name: FamilyReminderQuota.name,
        schema: FamilyReminderQuotaSchema,
      },
      {
        name: FamilyHealthMetricSharing.name,
        schema: FamilyHealthMetricSharingSchema,
      },
      { name: FamilyCommandReceipt.name, schema: FamilyCommandReceiptSchema },
    ]),
  ],
  controllers: [
    FamilyLinksController,
    AdminFamilyLinksController,
    FamilyHealthMetricsController,
  ],
  providers: [
    ScheduleFamilyReminders,
    DeliverFamilyReminder,
    MongooseFamilyReminderDeliveryStore,
    PatientTaskReminderOutboxAdapter,
    {
      provide: FAMILY_REMINDER_DELIVERY_STORE,
      useExisting: MongooseFamilyReminderDeliveryStore,
    },
    {
      provide: PATIENT_TASK_REMINDER_OUTBOX,
      useExisting: PatientTaskReminderOutboxAdapter,
    },
    MongooseFamilyHealthMetricSharingRepository,
    {
      provide: FAMILY_HEALTH_METRIC_SHARING_REPOSITORY,
      useExisting: MongooseFamilyHealthMetricSharingRepository,
    },
    GrantFamilyHealthMetricSharing,
    RevokeFamilyHealthMetricSharing,
    ReadFamilyHealthMetrics,
    FamilyHealthSharingNotificationService,
    CreateFamilyInvitation,
    AcceptFamilyInvitation,
    RejectFamilyInvitation,
    RedeemFamilyInvitation,
    ChangeFamilyLinkStatus,
    UpdateFamilyReminderPermissions,
    RegenerateFamilyInvitationArtifacts,
    ExpireFamilyInvitations,
    RedisFamilyInvitationAttemptLimiter,
    {
      provide: FAMILY_INVITATION_ATTEMPT_LIMITER,
      useExisting: RedisFamilyInvitationAttemptLimiter,
    },
    MongooseFamilyLinkRepository,
    {
      provide: FAMILY_LINK_REPOSITORY,
      useExisting: MongooseFamilyLinkRepository,
    },
    MongooseFamilyInvitationCreationStore,
    MongooseFamilyLinkReadRepository,
    ReadFamilyLinks,
    {
      provide: FAMILY_LINK_READ_REPOSITORY,
      useExisting: MongooseFamilyLinkReadRepository,
    },
    {
      provide: FAMILY_INVITATION_CREATION_STORE,
      useExisting: MongooseFamilyInvitationCreationStore,
    },
  ],
  exports: [
    ScheduleFamilyReminders,
    DeliverFamilyReminder,
    FamilyHealthSharingNotificationService,
    CreateFamilyInvitation,
    AcceptFamilyInvitation,
    RejectFamilyInvitation,
    RedeemFamilyInvitation,
    ChangeFamilyLinkStatus,
    UpdateFamilyReminderPermissions,
    RegenerateFamilyInvitationArtifacts,
    ExpireFamilyInvitations,
    ReadFamilyLinks,
  ],
})
export class FamilyCompanionModule {}
