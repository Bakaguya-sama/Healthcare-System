import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { PlanAdministrationService } from '../../application/services/plan-administration.service';
import { CreatePlanDraftDto } from '../dto/plan.dto';
@ApiTags('billing-plans') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN) @Controller('billing/plans')
export class PlansController {
  constructor(private readonly plans: PlanAdministrationService) {}
  @Get() list() { return this.plans.list(); }
  @Post('drafts') create(@CurrentUser('sub') adminId: string, @Body() dto: CreatePlanDraftDto) { return this.plans.createDraft(adminId, dto); }
  @Post('deploy-defaults') deployDefaults(@CurrentUser('sub') adminId: string) { return this.plans.deployDefaultPlans(adminId); }
  @Post(':id/publish') publish(@CurrentUser('sub') adminId: string, @Param('id') id: string) { return this.plans.publish(adminId, id); }
  @Post(':id/retire') retire(@CurrentUser('sub') adminId: string, @Param('id') id: string) { return this.plans.retire(adminId, id); }
}
