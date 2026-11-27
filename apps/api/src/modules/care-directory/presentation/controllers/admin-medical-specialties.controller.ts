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
import { ManageSpecialtyCatalog } from '../../application/use-cases/manage-specialty-catalog.use-case';
import {
  CreateMedicalSpecialtyDto,
  RetireSpecialtyDto,
  SpecialtyAdminListDto,
  UpdateMedicalSpecialtyDto,
} from '../dto/facility-directory.dto';

@ApiTags('admin-medical-specialties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/medical-specialties')
export class AdminMedicalSpecialtiesController {
  constructor(private readonly catalog: ManageSpecialtyCatalog) {}
  @Get() list(
    @CurrentUser('sub') actorId: string,
    @Query() query: SpecialtyAdminListDto,
  ) {
    return this.catalog.list(actorId, query.status);
  }
  @Post() @ApiHeader({ name: 'Idempotency-Key', required: true }) create(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateMedicalSpecialtyDto,
  ) {
    return this.catalog.create(actorId, key, dto);
  }
  @Patch(':code')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  update(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('code') code: string,
    @Body() dto: UpdateMedicalSpecialtyDto,
  ) {
    return this.catalog.update(actorId, key, code, dto);
  }
  @Post(':code/actions/retire')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  retire(
    @CurrentUser('sub') actorId: string,
    @Headers('idempotency-key') key: string,
    @Param('code') code: string,
    @Body() dto: RetireSpecialtyDto,
  ) {
    return this.catalog.retire(actorId, key, code, dto);
  }
}
