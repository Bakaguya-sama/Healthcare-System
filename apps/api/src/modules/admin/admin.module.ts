import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../auth/entities/user.schema';
import { Doctor, DoctorSchema } from '../users/entities/doctor.schema';
import {
  ViolationReport,
  ViolationReportSchema,
} from './entities/violation-report.entity';
import { Session, SessionSchema } from '../sessions/entities/session.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Doctor.name, schema: DoctorSchema },
      { name: ViolationReport.name, schema: ViolationReportSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
