import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserEntity, UserEntitySchema } from '../users/entities/user.entity';
import {
  ViolationReport,
  ViolationReportSchema,
} from './entities/violation-report.entity';
import { Session, SessionSchema } from '../sessions/entities/session.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserEntity.name, schema: UserEntitySchema },
      { name: ViolationReport.name, schema: ViolationReportSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
