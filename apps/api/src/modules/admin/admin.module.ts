import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../users/entities/user.schema';
import { Doctor, DoctorSchema } from '../users/entities/doctor.schema';
import { Admin, AdminSchema } from '../admins/entities/admin.entity';
import { NodemailerService } from '../nodemailer/nodemailer.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ConsultationsModule } from '../consultations/consultations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Doctor.name, schema: DoctorSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    NotificationsModule,
    UsersModule,
    ConsultationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, NodemailerService],
  exports: [AdminService],
})
export class AdminModule {}
