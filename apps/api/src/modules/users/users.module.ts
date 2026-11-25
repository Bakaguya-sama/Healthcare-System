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
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { DoctorBookingSettingsService } from './application/services/doctors/doctor-booking-settings.service';
import { DoctorBookingSettingsController } from './presentation/controllers/doctor-booking-settings.controller';
import { SearchFamilyCompanionContacts } from './application/use-cases/search-family-companion-contacts.use-case';
import { FAMILY_COMPANION_CONTACT_DIRECTORY } from './application/ports/family-companion-contact-directory.port';
import { MongooseFamilyCompanionContactDirectory } from './infrastructure/mongoose/mongoose-family-companion-contact.directory';

@Module({
  imports: [
    FilesModule,
    PlatformAuditModule,
    OutboxModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PatientProfile.name, schema: PatientProfileSchema },
    ]),
  ],
  controllers: [
    UsersController,
    PatientProfileController,
    AdminsController,
    DoctorBookingSettingsController,
  ],
  providers: [
    UsersService,
    DoctorDirectoryService,
    UsersCacheService,
    PatientProfileService,
    AdminsService,
    UserAdministrationService,
    DoctorBookingSettingsService,
    SearchFamilyCompanionContacts,
    MongooseFamilyCompanionContactDirectory,
    {
      provide: FAMILY_COMPANION_CONTACT_DIRECTORY,
      useExisting: MongooseFamilyCompanionContactDirectory,
    },
  ],
  exports: [
    MongooseModule,
    UsersService,
    DoctorDirectoryService,
    UsersCacheService,
    AdminsService,
    UserAdministrationService,
    DoctorBookingSettingsService,
  ],
})
export class UsersModule {}
