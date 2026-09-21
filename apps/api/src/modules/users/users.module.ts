import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './entities/user.schema';
import { Patient, PatientSchema } from './patients/entities/patient.entity';
import { FilesModule } from '../../infrastructure/files/files.module';
import { UsersCacheService } from './users-cache.service';
import { DoctorDirectoryService } from './doctor-directory.service';
import { PatientsController } from './patients/patients.controller';
import { PatientsService } from './patients/patients.service';
import { AdminsController } from './admins/admins.controller';
import { AdminsService } from './admins/admins.service';
import { UserAdministrationService } from './user-administration.service';

@Module({
  imports: [
    FilesModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Patient.name, schema: PatientSchema },
    ]),
  ],
  controllers: [UsersController, PatientsController, AdminsController],
  providers: [
    UsersService,
    DoctorDirectoryService,
    UsersCacheService,
    PatientsService,
    AdminsService,
    UserAdministrationService,
  ],
  exports: [
    MongooseModule,
    UsersService,
    DoctorDirectoryService,
    UsersCacheService,
    PatientsService,
    AdminsService,
    UserAdministrationService,
  ],
})
export class UsersModule {}
