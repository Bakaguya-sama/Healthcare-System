import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FreeSubscriptionGrantService } from '../../../billing/public-api';
import type { FamilyReminderPermission } from '../../domain/policies/family-companion.policy';
import {
  FamilyPolicyError,
  normalizeReminderPermissions,
} from '../../domain/policies/family-companion.policy';
import {
  FAMILY_LINK_REPOSITORY,
  type FamilyLinkRepository,
} from '../ports/family-link.repository';
import {
  assertFamilyCompanionEnabled,
  assertFamilyIdempotencyKey,
  assertValidFamilyId,
} from './family-companion-command-guard';

export interface AcceptFamilyInvitationCommand {
  consentVersion: string;
  permissions: FamilyReminderPermission[];
}

@Injectable()
export class AcceptFamilyInvitation {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
    private readonly subscriptions: FreeSubscriptionGrantService,
  ) {}

  async execute(
    contactUserId: string,
    familyLinkId: string,
    command: AcceptFamilyInvitationCommand,
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(contactUserId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    if (!command.consentVersion?.trim()) {
      throw new BadRequestException('FAMILY_CONSENT_VERSION_REQUIRED');
    }
    let permissions: FamilyReminderPermission[];
    try {
      permissions = normalizeReminderPermissions(command.permissions);
    } catch (error) {
      if (error instanceof FamilyPolicyError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }
    const replay = await this.invitations.findAcceptedInvitationReplay(
      contactUserId,
      familyLinkId,
      { consentVersion: command.consentVersion.trim(), permissions },
      idempotencyKey.trim(),
    );
    if (replay)
      return {
        statusCode: 200,
        message: 'Family invitation accepted',
        data: replay,
      };
    const owner = await this.invitations.findPendingInvitationOwner(
      contactUserId,
      familyLinkId,
    );
    if (!owner) throw new NotFoundException('Invitation not found');
    const subscription = await this.subscriptions.getEffectiveSubscription(
      owner.patientId,
    );
    const limit = Number(subscription?.planSnapshot?.familyLinkLimit ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10)
      throw new ForbiddenException('FAMILY_ENTITLEMENT_UNAVAILABLE');
    const data = await this.invitations.acceptInvitation(
      contactUserId,
      familyLinkId,
      { consentVersion: command.consentVersion.trim(), permissions },
      idempotencyKey.trim(),
      limit,
      owner.invitationVersion,
    );
    return { statusCode: 200, message: 'Family invitation accepted', data };
  }
}
