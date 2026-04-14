import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../auth/entities/user.schema';
import { Doctor, DoctorSchema } from '../users/entities/doctor.schema';
import { Session, SessionSchema } from '../sessions/entities/session.entity';
import {
  Admin,
  AdminDocument,
  AdminSchema,
} from '../admins/entities/admin.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Doctor.name, schema: DoctorSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
