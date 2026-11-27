import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { ListMedicalSpecialties } from '../../application/use-cases/list-medical-specialties.use-case';
import { SearchMedicalFacilities } from '../../application/use-cases/search-medical-facilities.use-case';
import { GetMedicalFacility } from '../../application/use-cases/get-medical-facility.use-case';
import { SearchMapFacilityCandidates } from '../../application/use-cases/search-map-facility-candidates.use-case';
import {
  PatientExternalFacilitySearchDto,
  PatientFacilitySearchDto,
} from '../dto/facility-directory.dto';

@ApiTags('medical-facilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PATIENT)
@Controller('medical-facilities')
export class PatientMedicalFacilitiesController {
  constructor(
    private readonly specialties: ListMedicalSpecialties,
    private readonly search: SearchMedicalFacilities,
    private readonly detail: GetMedicalFacility,
    private readonly externalSearch: SearchMapFacilityCandidates,
  ) {}

  @Get('specialties') listSpecialties() {
    return this.specialties.execute();
  }

  @Post('search') searchInternal(
    @CurrentUser('sub') patientId: string,
    @Body() dto: PatientFacilitySearchDto,
  ) {
    return this.search.execute(patientId, {
      ...dto,
      ...(dto.location
        ? {
            location: {
              longitude: dto.location.longitude,
              latitude: dto.location.latitude,
            },
          }
        : {}),
    });
  }

  @Get(':id') getVerified(
    @CurrentUser('sub') patientId: string,
    @Param('id') id: string,
  ) {
    return this.detail.execute(patientId, id);
  }

  @Post('external-search')
  searchGooglePlaces(
    @CurrentUser('sub') patientId: string,
    @Body() dto: PatientExternalFacilitySearchDto,
  ) {
    return this.externalSearch.forPatient(patientId, {
      ...dto,
      ...(dto.location
        ? {
            location: {
              longitude: dto.location.longitude,
              latitude: dto.location.latitude,
            },
          }
        : {}),
    });
  }
}
