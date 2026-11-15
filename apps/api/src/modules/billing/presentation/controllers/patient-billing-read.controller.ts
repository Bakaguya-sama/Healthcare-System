import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { UserRole } from '../../../../core/domain/user.enums';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { PatientBillingReadService } from '../../application/services/patient-billing-read.service';
import {
  PatientPlanPageDto,
  PatientPlanSummaryDto,
  PatientSubscriptionPageDto,
  PatientSubscriptionUsageDto,
  QueryPatientSubscriptionsDto,
  QueryPublishedPlansDto,
} from '../dto/patient-billing-read.dto';

@ApiTags('patient-billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PATIENT)
@Controller()
export class PatientBillingReadController {
  constructor(private readonly reads: PatientBillingReadService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List effective published Plans for Patient' })
  @ApiOkResponse({ type: PatientPlanPageDto })
  @ApiForbiddenResponse({ description: 'Patient role is required' })
  listPlans(@Query() query: QueryPublishedPlansDto) {
    return this.reads.listPublishedPlans(query);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Read one effective published Plan for Patient' })
  @ApiOkResponse({ type: PatientPlanSummaryDto })
  @ApiNotFoundResponse({
    description:
      'Plan is invalid, missing, unpublished, retired or outside its effective window',
  })
  getPlan(@Param('id') id: string) {
    return this.reads.getPublishedPlan(id);
  }

  @Get('subscriptions/me')
  @ApiOperation({
    summary:
      'List Patient Subscription history and current effective entitlement',
  })
  @ApiOkResponse({ type: PatientSubscriptionPageDto })
  @ApiServiceUnavailableResponse({
    description: 'An immutable snapshot is corrupt',
  })
  subscriptions(
    @CurrentUser('sub') patientId: string,
    @Query() query: QueryPatientSubscriptionsDto,
  ) {
    return this.reads.listPatientSubscriptions(patientId, query);
  }

  @Get('subscriptions/me/usage')
  @ApiOperation({ summary: 'Read current-cycle ordinary consultation quota' })
  @ApiOkResponse({ type: PatientSubscriptionUsageDto })
  @ApiNotFoundResponse({ description: 'No current Subscription is available' })
  @ApiServiceUnavailableResponse({
    description: 'Cycle, snapshot or atomic usage counters are inconsistent',
  })
  usage(@CurrentUser('sub') patientId: string) {
    return this.reads.getPatientUsage(patientId);
  }
}
