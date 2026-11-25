import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { UserRole } from '../../../../core/domain/user.enums';
import { CreateFamilyInvitation } from '../../application/use-cases/create-family-invitation.use-case';
import { AcceptFamilyInvitation } from '../../application/use-cases/accept-family-invitation.use-case';
import { RejectFamilyInvitation } from '../../application/use-cases/reject-family-invitation.use-case';
import { RedeemFamilyInvitation } from '../../application/use-cases/redeem-family-invitation.use-case';
import { ChangeFamilyLinkStatus } from '../../application/use-cases/change-family-link-status.use-case';
import { UpdateFamilyReminderPermissions } from '../../application/use-cases/update-family-reminder-permissions.use-case';
import { RegenerateFamilyInvitationArtifacts } from '../../application/use-cases/regenerate-family-invitation-artifacts.use-case';
import { ReadFamilyLinks } from '../../application/queries/read-family-links';
import {
  AcceptFamilyInvitationDto,
  CreateFamilyLinkDto,
  FamilyLinkActionDto,
  FamilyLinksQueryDto,
  RedeemFamilyInvitationDto,
  UpdateFamilyPermissionsDto,
} from '../dto/family-link.dto';

@ApiTags('family-links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PATIENT)
@Controller('family-links')
export class FamilyLinksController {
  constructor(
    private readonly createFamilyInvitation: CreateFamilyInvitation,
    private readonly acceptFamilyInvitation: AcceptFamilyInvitation,
    private readonly rejectFamilyInvitation: RejectFamilyInvitation,
    private readonly redeemFamilyInvitation: RedeemFamilyInvitation,
    private readonly changeFamilyLinkStatus: ChangeFamilyLinkStatus,
    private readonly updateFamilyPermissionsUseCase: UpdateFamilyReminderPermissions,
    private readonly regenerateArtifactsUseCase: RegenerateFamilyInvitationArtifacts,
    private readonly readFamilyLinks: ReadFamilyLinks,
  ) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @CurrentUser('sub') userId: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateFamilyLinkDto,
  ) {
    return this.createFamilyInvitation.execute(userId, dto, key);
  }

  @Get()
  list(
    @CurrentUser('sub') userId: string,
    @Query() query: FamilyLinksQueryDto,
  ) {
    return this.readFamilyLinks.listForParticipant(userId, query);
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.readFamilyLinks.getForParticipant(userId, id);
  }

  @Post('redeem')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  redeem(
    @CurrentUser('sub') userId: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: RedeemFamilyInvitationDto,
  ) {
    return this.redeemFamilyInvitation.execute(userId, dto, key);
  }

  @Post(':id/accept')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  accept(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: AcceptFamilyInvitationDto,
  ) {
    return this.acceptFamilyInvitation.execute(userId, id, dto, key);
  }

  @Post(':id/actions/:action')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  action(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('action') action: 'decline' | 'pause' | 'resume' | 'revoke',
    @Headers('idempotency-key') key: string,
    @Body() dto: FamilyLinkActionDto,
  ) {
    if (action === 'decline')
      return this.rejectFamilyInvitation.execute(userId, id, dto.reason, key);
    if (!['pause', 'resume', 'revoke'].includes(action))
      throw new BadRequestException('INVALID_FAMILY_ACTION');
    return this.changeFamilyLinkStatus.execute(
      userId,
      id,
      action,
      dto.reason,
      key,
    );
  }

  @Put(':id/permissions')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  updatePermissions(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
    @Body() dto: UpdateFamilyPermissionsDto,
  ) {
    return this.updateFamilyPermissionsUseCase.execute(userId, id, dto, key);
  }

  @Post(':id/regenerate-artifacts')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  regenerate(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    return this.regenerateArtifactsUseCase.execute(userId, id, key);
  }
}

@ApiTags('admin-family-links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/family-links')
export class AdminFamilyLinksController {
  constructor(private readonly readFamilyLinks: ReadFamilyLinks) {}

  @Get()
  list(@Query() query: FamilyLinksQueryDto) {
    return this.readFamilyLinks.listForAdmin(query);
  }
}
