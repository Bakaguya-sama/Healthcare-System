import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.validation';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { OutboxModule } from './outbox.module';
import { OutboxWorkerService } from './outbox-worker.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from '../../modules/notifications/domain/entities/notification.entity';
import { NotificationsService } from '../../modules/notifications/application/services/notifications.service';
import { PlatformAuditModule } from '../../modules/platform-audit/platform-audit.module';
import { HEALTH_METRIC } from '../../modules/health-tracking/public-api';
import {
  HealthMetric,
  HealthMetricSchema,
} from '../../modules/health-tracking/domain/entities/health-metric.entity';
import { HealthMetricQueryService } from '../../modules/health-tracking/application/services/health-metric-query.service';
import {
  CareTask,
  CareTaskSchema,
} from '../../modules/chronic-care/domain/entities/care-task.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from '../../modules/chronic-care/domain/entities/patient-care-program.entity';
import {
  HealthEvaluation,
  HealthEvaluationSchema,
} from '../../modules/chronic-care/domain/entities/health-evaluation.entity';
import {
  CareAlert,
  CareAlertSchema,
} from '../../modules/chronic-care/domain/entities/care-alert.entity';
import { CARE_TASK_QUEUE } from '../../modules/chronic-care/application/ports/care-task-queue.port';
import { OutboxCareTaskQueue } from '../../modules/chronic-care/infrastructure/adapters/outbox-care-task-queue.adapter';
import { HealthEvaluationService } from '../../modules/chronic-care/application/services/health-evaluation.service';
import { CareAlertService } from '../../modules/chronic-care/application/services/care-alert.service';
import { CareTaskSchedulerService } from '../../modules/chronic-care/application/services/care-task-scheduler.service';
import { CareTaskReminderService } from '../../modules/chronic-care/application/services/care-task-reminder.service';
import { CareMetricEvaluationService } from '../../modules/chronic-care/application/services/care-metric-evaluation.service';
import { BillingModule } from '../../modules/billing/billing.module';
import { Consultation, ConsultationSchema } from '../../modules/consultations/domain/entities/consultations/consultation.entity';
import { AuditLog, AuditLogSchema } from '../../modules/platform-audit/domain/entities/audit-log.entity';
import { ConsultationStaleRecoveryService } from '../../modules/consultations/application/services/consultations/consultation-stale-recovery.service';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    OutboxModule,
    PlatformAuditModule,
    BillingModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: HealthMetric.name, schema: HealthMetricSchema },
      { name: CareTask.name, schema: CareTaskSchema },
      { name: PatientCareProgram.name, schema: PatientCareProgramSchema },
      { name: HealthEvaluation.name, schema: HealthEvaluationSchema },
      { name: CareAlert.name, schema: CareAlertSchema },
      { name: Consultation.name, schema: ConsultationSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [
    OutboxWorkerService,
    NotificationsService,
    HealthMetricQueryService,
    { provide: HEALTH_METRIC, useExisting: HealthMetricQueryService },
    OutboxCareTaskQueue,
    { provide: CARE_TASK_QUEUE, useExisting: OutboxCareTaskQueue },
    HealthEvaluationService,
    CareAlertService,
    CareTaskSchedulerService,
    CareTaskReminderService,
    CareMetricEvaluationService,
    ConsultationStaleRecoveryService,
  ],
})
export class OutboxWorkerModule {}
