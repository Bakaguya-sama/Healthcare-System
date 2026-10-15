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

@Module({
  imports: [
    PlatformAuditModule,
    OutboxModule,
    HealthTrackingModule,
    ConsultationsModule,
    AiAdvisoryModule,
    BillingModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: CareProgram.name, schema: CareProgramSchema },
      { name: CareRule.name, schema: CareRuleSchema },
      { name: PatientCareProgram.name, schema: PatientCareProgramSchema },
      { name: CareTask.name, schema: CareTaskSchema },
      { name: HealthEvaluation.name, schema: HealthEvaluationSchema },
      { name: CareAlert.name, schema: CareAlertSchema },
      { name: CareReport.name, schema: CareReportSchema },
      { name: CareSummary.name, schema: CareSummarySchema },
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
    CareTaskSchedulerService,
    CareTaskProgressService,
    HealthEvaluationService,
    CareAlertService,
    CareReportService,
    CareSummaryService,
    OutboxCareTaskQueue,
    {
      provide: CARE_TASK_QUEUE,
      useExisting: OutboxCareTaskQueue,
    },
    UsersDoctorAdapter,
    UsersPatientAdapter,
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
      provide: CARE_PROGRAM_ACCESS_PORT,
      useExisting: BillingCareProgramAccessAdapter,
    },
  ],
  exports: [MongooseModule, CareProgramRuleService],
})
export class ChronicCareModule {}
