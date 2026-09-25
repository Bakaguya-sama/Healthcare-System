import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './entities/user.schema';
import {
  PatientProfile,
  PatientProfileSchema,
} from './patients/schemas/patient-profile.schema';
import { FilesModule } from '../../infrastructure/files/files.module';
import { UsersCacheService } from './users-cache.service';
import { DoctorDirectoryService } from './doctors/doctor-directory.service';
import { PatientProfileController } from './patients/patient-profile.controller';
import { PatientProfileService } from './patients/patient-profile.service';
import { AdminsController } from './admins/admins.controller';
import { AdminsService } from './admins/admins.service';
import { UserAdministrationService } from './user-administration.service';

@Module({
  imports: [
    FilesModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PatientProfile.name, schema: PatientProfileSchema },
    ]),
  ],
  controllers: [UsersController, PatientProfileController, AdminsController],
  providers: [
    UsersService,
    DoctorDirectoryService,
    UsersCacheService,
    PatientProfileService,
    AdminsService,
    UserAdministrationService,
  ],
  exports: [
    MongooseModule,
    UsersService,
    DoctorDirectoryService,
    UsersCacheService,
    AdminsService,
    UserAdministrationService,
  ],
})
export class UsersModule {}
