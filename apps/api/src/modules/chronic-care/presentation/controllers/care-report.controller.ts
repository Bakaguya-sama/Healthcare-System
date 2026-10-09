import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { CareReportService } from '../../application/services/care-report.service';
import { CareSummaryService } from '../../application/services/care-summary.service';
import type { CareActor } from '../../application/services/care-program-rule.service';
import {
  GenerateCareReportDto,
  GenerateCareSummaryDto,
  QueryCareReportDto,
} from '../dto/care-report.dto';

@ApiTags('care-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CareReportController {
  constructor(
    private readonly reports: CareReportService,
    private readonly summaries: CareSummaryService,
  ) {}

  @Post('care-enrollments/:id/reports')
  @Roles(UserRole.DOCTOR)
  generate(
    @CurrentUser() actor: CareActor,
    @Param('id') enrollmentId: string,
    @Body() dto: GenerateCareReportDto,
  ) {
    return this.reports.generate(
      actor,
      enrollmentId,
      dto.reportType,
      new Date(dto.dataUntil),
    );
  }

  @Get('care-enrollments/:id/reports')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  list(
    @CurrentUser() actor: CareActor,
    @Param('id') enrollmentId: string,
    @Query() query: QueryCareReportDto,
  ) {
    return this.reports.list(actor, enrollmentId, query.reportType);
  }

  @Get('care-reports/:id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  get(@CurrentUser() actor: CareActor, @Param('id') reportId: string) {
    return this.reports.get(actor, reportId);
  }

  @Post('care-reports/:id/summaries')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  generateSummary(
    @CurrentUser() actor: CareActor,
    @Param('id') reportId: string,
    @Body() dto: GenerateCareSummaryDto,
  ) {
    return this.summaries.generate(actor, reportId, dto.audience);
  }
}
