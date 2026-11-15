import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { CareReportService } from '../../application/services/care-report.service';
import { CareSummaryService } from '../../application/services/care-summary.service';
import type { CareActor } from '../../application/services/care-program-rule.service';
import {
  CreateCareReportExportDto,
  CareReportExportDto,
  GenerateCareReportDto,
  GenerateCareSummaryDto,
  QueryCareReportDto,
} from '../dto/care-report.dto';
import { CareReportExportService } from '../../application/services/care-report-export.service';

@ApiTags('care-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CareReportController {
  constructor(
    private readonly reports: CareReportService,
    private readonly summaries: CareSummaryService,
    private readonly reportExports: CareReportExportService,
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

  @Post('care-reports/:id/exports')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({
    summary: 'Create or replay an asynchronous private report export',
  })
  @ApiAcceptedResponse({
    type: CareReportExportDto,
    description: 'Durable export job accepted',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency conflict or entitlement projection unavailable',
  })
  createExport(
    @CurrentUser() actor: CareActor,
    @Param('id') reportId: string,
    @Body() dto: CreateCareReportExportDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reportExports.create(
      actor,
      reportId,
      dto.format,
      idempotencyKey,
    );
  }

  @Get('care-report-exports/:id')
  @Roles(UserRole.PATIENT, UserRole.DOCTOR)
  @ApiOperation({
    summary: 'Read own export status and a short-lived URL when ready',
  })
  @ApiOkResponse({
    type: CareReportExportDto,
    description: 'Owner-scoped export status',
  })
  @ApiNotFoundResponse({
    description: 'Export is missing or belongs to another actor',
  })
  getExport(@CurrentUser() actor: CareActor, @Param('id') exportId: string) {
    return this.reportExports.get(actor, exportId);
  }
}
