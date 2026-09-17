import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from '../users/entities/user.schema';
import { AuthSession, AuthSessionSchema } from './entities/auth-session.schema';
import { AuthEvent, AuthEventSchema } from './entities/auth-event.schema';
import { OtpService } from './otp.service';
import { Doctor, DoctorSchema } from '../users/entities/doctor.schema';
import { Admin, AdminSchema } from '../admins/entities/admin.entity';
import { NodemailerService } from '../nodemailer/nodemailer.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuthCoreModule } from '../../core/auth-core/auth-core.module';

@Module({
  imports: [
    AuthCoreModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthSession.name, schema: AuthSessionSchema },
      { name: AuthEvent.name, schema: AuthEventSchema },
      { name: Doctor.name, schema: DoctorSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, NodemailerService, CloudinaryService],
})
export class AuthModule {}
