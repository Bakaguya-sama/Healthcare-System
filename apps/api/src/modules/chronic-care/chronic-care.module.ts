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

@Module({
  imports: [
    PlatformAuditModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: CareProgram.name, schema: CareProgramSchema },
      { name: CareRule.name, schema: CareRuleSchema },
      { name: PatientCareProgram.name, schema: PatientCareProgramSchema },
      {
        name: CareCommandIdempotency.name,
        schema: CareCommandIdempotencySchema,
      },
    ]),
  ],
  controllers: [CareProgramRuleController, CareEnrollmentController],
  providers: [
    CareProgramRuleService,
    CareEnrollmentService,
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
