import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from './entities/user.schema';
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
      { name: Doctor.name, schema: DoctorSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, NodemailerService, CloudinaryService],
})
export class AuthModule {}
