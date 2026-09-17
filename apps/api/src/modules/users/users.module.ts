import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './entities/user.schema';
import { Patient, PatientSchema } from '../patients/entities/patient.entity';
import { Doctor, DoctorSchema } from './entities/doctor.schema';
import { Admin, AdminSchema } from '../admins/entities/admin.entity';
import { Review, ReviewSchema } from '../reviews/entities/review.entity';
import {
  Violation,
  ViolationSchema,
} from '../violations/entities/violation.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersCacheService } from './users-cache.service';
import { DoctorDirectoryService } from './doctor-directory.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Patient.name, schema: PatientSchema },
      { name: Doctor.name, schema: DoctorSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Violation.name, schema: ViolationSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, DoctorDirectoryService, CloudinaryService, UsersCacheService],
  exports: [UsersService, DoctorDirectoryService, UsersCacheService],
})
export class UsersModule {}
