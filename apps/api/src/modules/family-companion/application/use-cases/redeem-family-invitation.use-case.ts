import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  FAMILY_INVITATION_ATTEMPT_LIMITER,
  type FamilyInvitationAttemptLimiter,
} from '../ports/family-invitation-attempt-limiter.port';
import {
  FAMILY_LINK_REPOSITORY,
  type FamilyLinkRepository,
} from '../ports/family-link.repository';
import {
  assertFamilyCompanionEnabled,
  assertFamilyIdempotencyKey,
  assertValidFamilyId,
} from './family-companion-command-guard';

export interface RedeemFamilyInvitationCommand {
  invitationToken?: string;
  shortCode?: string;
}

@Injectable()
export class RedeemFamilyInvitation {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
    @Inject(FAMILY_INVITATION_ATTEMPT_LIMITER)
    private readonly attempts: FamilyInvitationAttemptLimiter,
  ) {}

  async execute(
    userId: string,
    command: RedeemFamilyInvitationCommand,
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(userId);
    assertFamilyIdempotencyKey(idempotencyKey);
    const hasToken = Boolean(command.invitationToken?.trim());
    const hasCode = Boolean(command.shortCode?.trim());
    if (hasToken === hasCode) {
      throw new BadRequestException('INVITATION_TOKEN_OR_CODE_REQUIRED');
    }
    if (hasCode) await this.attempts.assertCanTryShortCode(userId);
    const invitationTokenHash = hasToken
      ? this.hash(command.invitationToken!.trim())
      : undefined;
    const shortCodeHash = hasCode
      ? this.hash(command.shortCode!.trim())
      : undefined;
    const data = await this.invitations.redeemInvitation(
      userId,
      {
        invitationTokenHash,
        shortCodeHash,
      },
      idempotencyKey.trim(),
    );
    return { statusCode: 200, message: 'Invitation ready for consent', data };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
