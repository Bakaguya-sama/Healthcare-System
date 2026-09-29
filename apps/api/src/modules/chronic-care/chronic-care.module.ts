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
import { UsersDoctorCapabilityAdapter } from './application/adapters/doctor.adapter';
import { DOCTOR_CAPABILITY_PORT } from './application/ports/doctor.repository.port';

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
  controllers: [CareProgramRuleController],
  providers: [
    CareProgramRuleService,
    UsersDoctorCapabilityAdapter,
    {
      provide: DOCTOR_CAPABILITY_PORT,
      useExisting: UsersDoctorCapabilityAdapter,
    },
  ],
  exports: [MongooseModule, CareProgramRuleService],
})
export class ChronicCareModule {}
