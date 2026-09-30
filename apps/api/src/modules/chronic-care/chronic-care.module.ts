import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareProgram, CareProgramSchema } from './entities/care-program.entity';
import { CareRule, CareRuleSchema } from './entities/care-rule.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from './entities/patient-care-program.entity';
import {
  CareCommandIdempotency,
  CareCommandIdempotencySchema,
} from './entities/care-command-idempotency.entity';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { UsersModule } from '../users/users.module';
import { CareProgramRuleService } from './application/care-program-rule.service';
import { CareProgramRuleController } from './care-program-rule.controller';
import { UsersDoctorAdapter } from './application/adapters/doctor.adapter';
import { DOCTOR_REPOSITORY_PORT } from './application/ports/doctor.repository.port';
import { PATIENT_REPOSITORY_PORT } from './application/ports/patient.repository.port';
import { CARE_PROGRAM_ACCESS_PORT } from './application/ports/care-program-access.port';
import { UsersPatientAdapter } from './application/adapters/patient.adapter';
import { NoEntitlementAdapter } from './application/adapters/no-entitlement.adapter';
import { CareEnrollmentService } from './application/care-enrollment.service';
import { CareEnrollmentController } from './care-enrollment.controller';
import { CareTask, CareTaskSchema } from './entities/care-task.entity';
import { CareTaskSchedulerService } from './care-task-scheduler.service';
import { CareTaskProgressService } from './care-task-progress.service';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { HealthTrackingModule } from '../health-tracking/health-tracking.module';
import { CareTaskController } from './care-task.controller';
import { CARE_TASK_QUEUE } from './application/ports/care-task-queue.port';
import { OutboxCareTaskQueue } from './application/adapters/outbox-care-task-queue.adapter';

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
