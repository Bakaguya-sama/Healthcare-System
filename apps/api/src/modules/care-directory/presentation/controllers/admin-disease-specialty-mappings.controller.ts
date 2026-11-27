import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { ManageDiseaseSpecialtyMappings } from '../../application/use-cases/manage-disease-specialty-mappings.use-case';
import {
  CreateDiseaseSpecialtyMappingDto,
  DiseaseSpecialtyMappingListDto,
  PublishDiseaseSpecialtyMappingDto,
  RetireDiseaseSpecialtyMappingDto,
  UpdateDiseaseSpecialtyMappingDto,
} from '../dto/facility-directory.dto';

@ApiTags('admin-disease-specialty-mappings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/disease-specialty-mappings')
export class AdminDiseaseSpecialtyMappingsController {
  constructor(private readonly mappings: ManageDiseaseSpecialtyMappings) {}
  @Get() list(
    @CurrentUser('sub') actorId: string,
    @Query() query: DiseaseSpecialtyMappingListDto,
  ) {
    return this.mappings.list(actorId, query);
  }
  @Post() @ApiHeader({ name: 'Idempotency-Key', required: true }) create(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateDiseaseSpecialtyMappingDto,
  ) {
    return this.mappings.create(actorId, key, dto);
  }
  @Patch(':id') @ApiHeader({ name: 'Idempotency-Key', required: true }) update(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: UpdateDiseaseSpecialtyMappingDto,
  ) {
    return this.mappings.update(actorId, key, id, dto);
  }
  @Post(':id/actions/publish')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  publish(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: PublishDiseaseSpecialtyMappingDto,
  ) {
    return this.mappings.publish(actorId, key, id, dto.expectedRevision);
  }
  @Post(':id/actions/retire')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('id') id: string,
    @Body() dto: RetireDiseaseSpecialtyMappingDto,
  ) {
    return this.mappings.retire(actorId, key, id, dto);
  }
}
