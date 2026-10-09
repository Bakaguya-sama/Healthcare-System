import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './application/services/users.service';
import { UsersController } from './presentation/controllers/users.controller';
import { User, UserSchema } from './domain/entities/users/user.schema';
import {
  PatientProfile,
  PatientProfileSchema,
} from './domain/entities/patients/patient-profile.schema';
import { FilesModule } from '../../infrastructure/files/files.module';
import { UsersCacheService } from './application/services/users-cache.service';
import { DoctorDirectoryService } from './application/services/doctors/doctor-directory.service';
import { PatientProfileController } from './presentation/controllers/patients/patient-profile.controller';
import { PatientProfileService } from './application/services/patients/patient-profile.service';
import { AdminsController } from './presentation/controllers/admins/admins.controller';
import { AdminsService } from './application/services/admins/admins.service';
import { UserAdministrationService } from './application/services/user-administration.service';

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
