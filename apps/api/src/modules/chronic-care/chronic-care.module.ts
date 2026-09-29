import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareProgram, CareProgramSchema } from './entities/care-program.entity';
import { CareRule, CareRuleSchema } from './entities/care-rule.entity';
import {
  PatientCareProgram,
  PatientCareProgramSchema,
} from './entities/patient-care-program.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CareProgram.name, schema: CareProgramSchema },
      { name: CareRule.name, schema: CareRuleSchema },
      { name: PatientCareProgram.name, schema: PatientCareProgramSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class ChronicCareModule {}
