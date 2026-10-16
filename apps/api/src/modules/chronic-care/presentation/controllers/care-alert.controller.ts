import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import type { CareActor } from '../../application/services/care-program-rule.service';
import { CareAlertService } from '../../application/services/care-alert.service';
import { EnrollmentReasonDto } from '../dto/care-enrollment.dto';
import { CreateConsultationFromCareAlertDto, QueryDoctorCareAlertsDto } from '../dto/care-alert.dto';

@ApiTags('care-alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care-alerts')
export class CareAlertController {
  constructor(private readonly alerts: CareAlertService) {}

  @Get()
  @Roles(UserRole.DOCTOR)
  inbox(
    @CurrentUser() actor: CareActor,
    @Query() query: QueryDoctorCareAlertsDto,
  ) {
    return this.alerts.listForDoctor(actor, query);
  }

  @Get(':id/detail')
  @Roles(UserRole.DOCTOR)
  doctorDetail(@CurrentUser() actor: CareActor, @Param('id') id: string) {
    return this.alerts.getForDoctor(actor, id);
  }

  @Get(':id')
  @Roles(UserRole.PATIENT)
  get(@CurrentUser() actor: CareActor, @Param('id') id: string) {
    return this.alerts.getForPatient(actor.id, id);
  }

  @Get(':id/audit')
  @Roles(UserRole.ADMIN)
  audit(@Param('id') id: string) {
    return this.alerts.getAuditForAdmin(id);
  }

  @Post(':id/acknowledge')
  @Roles(UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  acknowledge(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
  ) {
    return this.alerts.transition(
      actor,
      id,
      'acknowledge',
      dto.expectedRevision,
      dto.reason,
    );
  }

  @Post(':id/resolve')
  @Roles(UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
  ) {
    return this.alerts.transition(
      actor,
      id,
      'resolve',
      dto.expectedRevision,
      dto.reason,
    );
  }

  @Post(':id/dismiss')
  @Roles(UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  dismiss(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
  ) {
    return this.alerts.transition(
      actor,
      id,
      'dismiss',
      dto.expectedRevision,
      dto.reason,
    );
  }

  @Post(':id/consultations')
  @Roles(UserRole.DOCTOR)
  createConsultation(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: CreateConsultationFromCareAlertDto,
  ) {
    return this.alerts.createConsultation(actor, id, dto);
  }
}
