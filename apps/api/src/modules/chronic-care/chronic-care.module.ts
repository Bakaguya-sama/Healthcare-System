import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CareProgram,
  CareProgramSchema,
} from './domain/entities/care-program.entity';
import { CareRule, CareRuleSchema } from './domain/entities/care-rule.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from './domain/entities/patient-care-program.entity';
import {
  CareCommandIdempotency,
  CareCommandIdempotencySchema,
} from './domain/entities/care-command-idempotency.entity';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { UsersModule } from '../users/users.module';
import { CareProgramRuleService } from './application/services/care-program-rule.service';
import { CareProgramRuleController } from './presentation/controllers/care-program-rule.controller';
import { UsersDoctorAdapter } from './infrastructure/adapters/doctor.adapter';
import { DOCTOR_REPOSITORY_PORT } from './application/ports/doctor.repository.port';
import { PATIENT_REPOSITORY_PORT } from './application/ports/patient.repository.port';
import { CARE_PROGRAM_ACCESS_PORT } from './application/ports/care-program-access.port';
import { UsersPatientAdapter } from './infrastructure/adapters/patient.adapter';
import { NoEntitlementAdapter } from './infrastructure/adapters/no-entitlement.adapter';
import { BillingModule } from '../billing/billing.module';
import { BillingCareProgramAccessAdapter } from './infrastructure/adapters/billing-care-program-access.adapter';
import { CareEnrollmentService } from './application/services/care-enrollment.service';
import { CareEnrollmentController } from './presentation/controllers/care-enrollment.controller';
import { CareTask, CareTaskSchema } from './domain/entities/care-task.entity';
import { CareTaskSchedulerService } from './application/services/care-task-scheduler.service';
import { CareTaskProgressService } from './application/services/care-task-progress.service';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { HealthTrackingModule } from '../health-tracking/health-tracking.module';
import { CareTaskController } from './presentation/controllers/care-task.controller';
import { CARE_TASK_QUEUE } from './application/ports/care-task-queue.port';
import { OutboxCareTaskQueue } from './infrastructure/adapters/outbox-care-task-queue.adapter';
import {
  HealthEvaluation,
  HealthEvaluationSchema,
} from './domain/entities/health-evaluation.entity';
import { HealthEvaluationService } from './application/services/health-evaluation.service';
import {
  CareAlert,
  CareAlertSchema,
} from './domain/entities/care-alert.entity';
import { CareAlertService } from './application/services/care-alert.service';
import { CareAlertController } from './presentation/controllers/care-alert.controller';
import {
  CareReport,
  CareReportSchema,
} from './domain/entities/care-report.entity';
import { CareReportService } from './application/services/care-report.service';
import { CareReportController } from './presentation/controllers/care-report.controller';
import { ConsultationsModule } from '../consultations/consultations.module';
import { AiAdvisoryModule } from '../ai-advisory/ai-advisory.module';
import {
  CareSummary,
  CareSummarySchema,
} from './domain/entities/care-summary.entity';
import { CareSummaryService } from './application/services/care-summary.service';
import { ChronicCareReadService } from './application/services/chronic-care-read.service';
import { UsersCareIdentityAdapter } from './infrastructure/adapters/care-identity.adapter';
import { CARE_IDENTITY_READER_PORT } from './application/ports/care-identity-reader.port';
import {
  CareContent,
  CareContentSchema,
} from './domain/entities/care-content.entity';
import { CONTENT_CATALOG_PORT } from './application/ports/content-catalog.port';
import { MongoContentCatalogAdapter } from './infrastructure/adapters/mongo-content-catalog.adapter';
import { CareRuleReadService } from './application/services/care-rule-read.service';
import {
  CareReportExport,
  CareReportExportSchema,
} from './domain/entities/care-report-export.entity';
import { CareReportExportService } from './application/services/care-report-export.service';
import { CareReportExportProcessorService } from './application/services/care-report-export-processor.service';
import { CloudinaryCareReportExportStorageAdapter } from './infrastructure/adapters/cloudinary-care-report-export-storage.adapter';
import { CARE_REPORT_EXPORT_STORAGE } from './application/ports/care-report-export-storage.port';
import { FilesModule } from '../../infrastructure/files/files.module';
import { CARE_TASK_REMINDER_READER } from './application/ports/care-task-reminder-reader.port';
import { MongooseCareTaskReminderReaderAdapter } from './infrastructure/adapters/mongoose-care-task-reminder-reader.adapter';
import { OutboxCareEnrollmentTaskSyncAdapter } from './infrastructure/adapters/outbox-care-enrollment-task-sync.adapter';
import { CARE_ENROLLMENT_TASK_SYNC_OUTBOX } from './application/ports/care-enrollment-task-sync-outbox.port';

@Module({
  imports: [
    PlatformAuditModule,
    OutboxModule,
    HealthTrackingModule,
    ConsultationsModule,
    AiAdvisoryModule,
    BillingModule,
    UsersModule,
    FilesModule,
    MongooseModule.forFeature([
      { name: CareProgram.name, schema: CareProgramSchema },
      { name: CareRule.name, schema: CareRuleSchema },
      { name: PatientCareProgram.name, schema: PatientCareProgramSchema },
      { name: CareTask.name, schema: CareTaskSchema },
      { name: HealthEvaluation.name, schema: HealthEvaluationSchema },
      { name: CareAlert.name, schema: CareAlertSchema },
      { name: CareReport.name, schema: CareReportSchema },
      { name: CareSummary.name, schema: CareSummarySchema },
      { name: CareContent.name, schema: CareContentSchema },
      { name: CareReportExport.name, schema: CareReportExportSchema },
      {
        name: CareCommandIdempotency.name,
        schema: CareCommandIdempotencySchema,
      },
    ]),
  ],
  controllers: [
    CareProgramRuleController,
    CareEnrollmentController,
    CareTaskController,
    CareAlertController,
    CareReportController,
  ],
  providers: [
    CareProgramRuleService,
    CareEnrollmentService,
    OutboxCareEnrollmentTaskSyncAdapter,
    {
      provide: CARE_ENROLLMENT_TASK_SYNC_OUTBOX,
      useExisting: OutboxCareEnrollmentTaskSyncAdapter,
    },
    CareTaskSchedulerService,
    MongooseCareTaskReminderReaderAdapter,
    {
      provide: CARE_TASK_REMINDER_READER,
      useExisting: MongooseCareTaskReminderReaderAdapter,
    },
    CareTaskProgressService,
    HealthEvaluationService,
    CareAlertService,
    CareReportService,
    CareSummaryService,
    ChronicCareReadService,
    CareRuleReadService,
    CareReportExportService,
    CareReportExportProcessorService,
    CloudinaryCareReportExportStorageAdapter,
    MongoContentCatalogAdapter,
    OutboxCareTaskQueue,
    {
      provide: CARE_TASK_QUEUE,
      useExisting: OutboxCareTaskQueue,
    },
    UsersDoctorAdapter,
    UsersPatientAdapter,
    UsersCareIdentityAdapter,
    // Retained as an explicit deny-by-default fallback for isolated tests;
    // production composition always receives Billing-backed access decisions.
    NoEntitlementAdapter,
    BillingCareProgramAccessAdapter,
    {
      provide: DOCTOR_REPOSITORY_PORT,
      useExisting: UsersDoctorAdapter,
    },
    { provide: PATIENT_REPOSITORY_PORT, useExisting: UsersPatientAdapter },
    {
      provide: CARE_IDENTITY_READER_PORT,
      useExisting: UsersCareIdentityAdapter,
    },
    {
      provide: CARE_PROGRAM_ACCESS_PORT,
      useExisting: BillingCareProgramAccessAdapter,
    },
    {
      provide: CONTENT_CATALOG_PORT,
      useExisting: MongoContentCatalogAdapter,
    },
    {
      provide: CARE_REPORT_EXPORT_STORAGE,
      useExisting: CloudinaryCareReportExportStorageAdapter,
    },
  ],
  exports: [
    MongooseModule,
    CareProgramRuleService,
    CareReportExportProcessorService,
    CARE_TASK_REMINDER_READER,
  ],
})
export class ChronicCareModule {}
