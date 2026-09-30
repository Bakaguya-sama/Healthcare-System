import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareProgram, CareProgramSchema } from './domain/entities/care-program.entity';
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
import { HealthEvaluation, HealthEvaluationSchema } from './domain/entities/health-evaluation.entity';
import { HealthEvaluationService } from './application/services/health-evaluation.service';

@Module({
  imports: [
    PlatformAuditModule,
    OutboxModule,
    HealthTrackingModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: CareProgram.name, schema: CareProgramSchema },
      { name: CareRule.name, schema: CareRuleSchema },
      { name: PatientCareProgram.name, schema: PatientCareProgramSchema },
      { name: CareTask.name, schema: CareTaskSchema },
      { name: HealthEvaluation.name, schema: HealthEvaluationSchema },
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
  ],
  providers: [
    CareProgramRuleService,
    CareEnrollmentService,
    CareTaskSchedulerService,
    CareTaskProgressService,
    HealthEvaluationService,
    OutboxCareTaskQueue,
    {
      provide: CARE_TASK_QUEUE,
      useExisting: OutboxCareTaskQueue,
    },
    UsersDoctorAdapter,
    UsersPatientAdapter,
    NoEntitlementAdapter,
    {
      provide: DOCTOR_REPOSITORY_PORT,
      useExisting: UsersDoctorAdapter,
    },
    { provide: PATIENT_REPOSITORY_PORT, useExisting: UsersPatientAdapter },
    { provide: CARE_PROGRAM_ACCESS_PORT, useExisting: NoEntitlementAdapter },
  ],
  exports: [MongooseModule, CareProgramRuleService],
})
export class ChronicCareModule {}
