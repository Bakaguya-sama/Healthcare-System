import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CARE_PROGRAM_DIRECTORY_READER } from '../chronic-care/public-api';
import { ChronicCareModule as ChronicCareRuntimeModule } from '../chronic-care/chronic-care.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import {
  FacilityCommandReceipt,
  FacilityCommandReceiptSchema,
} from './infrastructure/mongoose/facility-command-receipt.schema';
import {
  MedicalSpecialty,
  MedicalSpecialtySchema,
} from './infrastructure/mongoose/medical-specialty.schema';
import {
  DiseaseSpecialtyMapping,
  DiseaseSpecialtyMappingSchema,
} from './infrastructure/mongoose/disease-specialty-mapping.schema';
import {
  MedicalFacility,
  MedicalFacilityRevision,
  MedicalFacilityRevisionSchema,
  MedicalFacilitySchema,
} from './infrastructure/mongoose/medical-facility.schema';
import {
  FacilityDuplicateGuard,
  FacilityDuplicateGuardSchema,
} from './infrastructure/mongoose/facility-duplicate-review.schema';
import {
  CARE_DIRECTORY_PROGRAM_CATALOG,
  CARE_DIRECTORY_QUERY_REPOSITORY,
  DISEASE_SPECIALTY_MAPPING_REPOSITORY,
  FACILITY_ADMIN_AUTHORITY,
  MAP_PROVIDER,
  MAP_PROVIDER_REQUEST_LIMITER,
  MEDICAL_FACILITY_REPOSITORY,
  SPECIALTY_CATALOG_REPOSITORY,
} from './application/ports/care-directory.ports';
import { MongooseCareDirectoryQueryRepository } from './infrastructure/mongoose/mongoose-care-directory-query.repository';
import { MongooseSpecialtyCatalogRepository } from './infrastructure/mongoose/mongoose-specialty-catalog.repository';
import { MongooseDiseaseSpecialtyMappingRepository } from './infrastructure/mongoose/mongoose-disease-specialty-mapping.repository';
import { MongooseMedicalFacilityRepository } from './infrastructure/mongoose/mongoose-medical-facility.repository';
import { FacilityCommandTransaction } from './infrastructure/mongoose/facility-command-transaction';
import { MongooseFacilityAdminAuthorityAdapter } from './infrastructure/adapters/mongoose-facility-admin-authority.adapter';
import { GooglePlacesAdapter } from './infrastructure/adapters/google-places.adapter';
import { RedisMapProviderRequestLimiter } from './infrastructure/adapters/redis-map-provider-request-limiter';
import { ListMedicalSpecialties } from './application/use-cases/list-medical-specialties.use-case';
import { SearchMedicalFacilities } from './application/use-cases/search-medical-facilities.use-case';
import { GetMedicalFacility } from './application/use-cases/get-medical-facility.use-case';
import { SearchMapFacilityCandidates } from './application/use-cases/search-map-facility-candidates.use-case';
import { ManageSpecialtyCatalog } from './application/use-cases/manage-specialty-catalog.use-case';
import { ManageDiseaseSpecialtyMappings } from './application/use-cases/manage-disease-specialty-mappings.use-case';
import { ManageMedicalFacilities } from './application/use-cases/manage-medical-facilities.use-case';
import { PatientMedicalFacilitiesController } from './presentation/controllers/patient-medical-facilities.controller';
import { AdminMedicalFacilitiesController } from './presentation/controllers/admin-medical-facilities.controller';
import { AdminMedicalSpecialtiesController } from './presentation/controllers/admin-medical-specialties.controller';
import { AdminDiseaseSpecialtyMappingsController } from './presentation/controllers/admin-disease-specialty-mappings.controller';

@Module({
  imports: [
    ChronicCareRuntimeModule,
    PlatformAuditModule,
    UsersModule,
    RedisModule,
    MongooseModule.forFeature([
      {
        name: FacilityCommandReceipt.name,
        schema: FacilityCommandReceiptSchema,
      },
      { name: MedicalSpecialty.name, schema: MedicalSpecialtySchema },
      {
        name: DiseaseSpecialtyMapping.name,
        schema: DiseaseSpecialtyMappingSchema,
      },
      { name: MedicalFacility.name, schema: MedicalFacilitySchema },
      {
        name: MedicalFacilityRevision.name,
        schema: MedicalFacilityRevisionSchema,
      },
      {
        name: FacilityDuplicateGuard.name,
        schema: FacilityDuplicateGuardSchema,
      },
    ]),
  ],
  controllers: [
    PatientMedicalFacilitiesController,
    AdminMedicalFacilitiesController,
    AdminMedicalSpecialtiesController,
    AdminDiseaseSpecialtyMappingsController,
  ],
  providers: [
    FacilityCommandTransaction,
    MongooseCareDirectoryQueryRepository,
    MongooseSpecialtyCatalogRepository,
    MongooseDiseaseSpecialtyMappingRepository,
    MongooseMedicalFacilityRepository,
    MongooseFacilityAdminAuthorityAdapter,
    GooglePlacesAdapter,
    RedisMapProviderRequestLimiter,
    {
      provide: MAP_PROVIDER_REQUEST_LIMITER,
      useExisting: RedisMapProviderRequestLimiter,
    },
    {
      provide: CARE_DIRECTORY_QUERY_REPOSITORY,
      useExisting: MongooseCareDirectoryQueryRepository,
    },
    {
      provide: SPECIALTY_CATALOG_REPOSITORY,
      useExisting: MongooseSpecialtyCatalogRepository,
    },
    {
      provide: DISEASE_SPECIALTY_MAPPING_REPOSITORY,
      useExisting: MongooseDiseaseSpecialtyMappingRepository,
    },
    {
      provide: MEDICAL_FACILITY_REPOSITORY,
      useExisting: MongooseMedicalFacilityRepository,
    },
    {
      provide: FACILITY_ADMIN_AUTHORITY,
      useExisting: MongooseFacilityAdminAuthorityAdapter,
    },
    { provide: MAP_PROVIDER, useExisting: GooglePlacesAdapter },
    {
      provide: CARE_DIRECTORY_PROGRAM_CATALOG,
      useExisting: CARE_PROGRAM_DIRECTORY_READER,
    },
    ListMedicalSpecialties,
    SearchMedicalFacilities,
    GetMedicalFacility,
    SearchMapFacilityCandidates,
    ManageSpecialtyCatalog,
    ManageDiseaseSpecialtyMappings,
    ManageMedicalFacilities,
  ],
})
export class CareDirectoryModule {}
