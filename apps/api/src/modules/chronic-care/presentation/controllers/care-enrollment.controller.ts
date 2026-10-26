import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import type { CareActor } from '../../application/services/care-program-rule.service';
import { CareEnrollmentService } from '../../application/services/care-enrollment.service';
import {
  BaselineDto,
  ConsentDto,
  CreateCareEnrollmentDto,
  EnrollmentReasonDto,
} from '../dto/care-enrollment.dto';

const Idempotent = ApiHeader({ name: 'Idempotency-Key', required: true });

@ApiTags('care-enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('care-enrollments')
export class CareEnrollmentController {
  constructor(private readonly enrollments: CareEnrollmentService) {}

  @Post() @Roles(UserRole.DOCTOR) @Idempotent async create(
    @CurrentUser() actor: CareActor,
    @Body() dto: CreateCareEnrollmentDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.create(actor, dto, key);
  }

  @Post(':id/consent') @Roles(UserRole.PATIENT) @Idempotent async consent(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: ConsentDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.submitConsent(actor, id, dto, key);
  }

  @Post(':id/baseline') @Roles(UserRole.PATIENT) @Idempotent async baseline(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: BaselineDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.submitBaseline(actor, id, dto, key);
  }

  @Post(':id/pause')
  @Roles(UserRole.DOCTOR)
  @Idempotent
  @HttpCode(HttpStatus.OK)
  async pause(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.transition(actor, id, 'pause', dto, key);
  }

  @Post(':id/resume')
  @Roles(UserRole.DOCTOR)
  @Idempotent
  @HttpCode(HttpStatus.OK)
  async resume(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.transition(actor, id, 'resume', dto, key);
  }

  @Post(':id/complete')
  @Roles(UserRole.DOCTOR)
  @Idempotent
  @HttpCode(HttpStatus.OK)
  async complete(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.transition(actor, id, 'complete', dto, key);
  }

  @Post(':id/cancel')
  @Roles(UserRole.DOCTOR)
  @Idempotent
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Body() dto: EnrollmentReasonDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.transition(actor, id, 'cancel', dto, key);
  }

  @Post(':id/withdraw-consent')
  @Roles(UserRole.PATIENT)
  @Idempotent
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @CurrentUser() actor: CareActor,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.enrollments.withdrawConsent(actor, id, key);
  }
}
