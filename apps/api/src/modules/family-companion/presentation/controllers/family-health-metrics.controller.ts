import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { GrantFamilyHealthMetricSharing } from '../../application/use-cases/grant-family-health-metric-sharing.use-case';
import { RevokeFamilyHealthMetricSharing } from '../../application/use-cases/revoke-family-health-metric-sharing.use-case';
import { ReadFamilyHealthMetrics } from '../../application/queries/read-family-health-metrics';
import { ChangeFamilyHealthMetricSharingDto } from '../dto/change-family-health-metric-sharing.dto';
import { SharedFamilyHealthMetricQueryDto } from '../dto/shared-family-health-metric-query.dto';
import {
  FamilyHealthMetricSummaryResponseDto,
  FamilyHealthMetricTrendResponseDto,
} from '../dto/family-health-metric-read-response.dto';

@ApiTags('family-links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PATIENT)
@Controller('family-links/:id')
export class FamilyHealthMetricsController {
  constructor(
    private readonly grant: GrantFamilyHealthMetricSharing,
    private readonly revoke: RevokeFamilyHealthMetricSharing,
    private readonly reads: ReadFamilyHealthMetrics,
  ) {}
  @Get('health-metric-sharing') getSharing(
    @CurrentUser('sub') actor: string,
    @Param('id') id: string,
  ) {
    return this.reads.getSharing(actor, id);
  }
  @Put('health-metric-sharing')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async grantOrUpdateSharing(
    @CurrentUser('sub') actor: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: ChangeFamilyHealthMetricSharingDto,
  ) {
    return {
      statusCode: 200,
      data: await this.grant.execute(actor, id, dto, key),
    };
  }
  @Delete('health-metric-sharing')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async revokeSharing(
    @CurrentUser('sub') actor: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    await this.revoke.execute(actor, id, key);
    return { statusCode: 200, data: { revoked: true } };
  }
  @Get('health-metrics/summary')
  @ApiOkResponse({ type: FamilyHealthMetricSummaryResponseDto })
  readSummary(
    @CurrentUser('sub') actor: string,
    @Param('id') id: string,
    @Query() query: SharedFamilyHealthMetricQueryDto,
  ) {
    return this.reads.read(actor, id, 'summary', this.query(query));
  }
  @Get('health-metrics/trend')
  @ApiOkResponse({ type: FamilyHealthMetricTrendResponseDto })
  readTrend(
    @CurrentUser('sub') actor: string,
    @Param('id') id: string,
    @Query() query: SharedFamilyHealthMetricQueryDto,
  ) {
    return this.reads.read(actor, id, 'trend', this.query(query));
  }
  private query(query: SharedFamilyHealthMetricQueryDto) {
    return {
      metricType: query.metricType,
      period: query.period,
      anchor: query.anchor,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: Number(query.limit ?? 20),
    };
  }
}
