import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FAMILY_LINK_REPOSITORY,
  type FamilyLinkRepository,
} from '../ports/family-link.repository';
import {
  assertFamilyCompanionEnabled,
  assertFamilyIdempotencyKey,
  assertValidFamilyId,
} from './family-companion-command-guard';

export type FamilyLinkStatusAction = 'pause' | 'resume' | 'revoke';

@Injectable()
export class ChangeFamilyLinkStatus {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(
    actorId: string,
    familyLinkId: string,
    action: FamilyLinkStatusAction,
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(actorId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    if (!['pause', 'resume', 'revoke'].includes(action)) {
      throw new BadRequestException('INVALID_FAMILY_ACTION');
    }
    const data = await this.invitations.changeFamilyLinkStatus(
      actorId,
      familyLinkId,
      action,
      reason?.trim().slice(0, 160),
      idempotencyKey.trim(),
    );
    return {
      statusCode: 200,
      message: `Family link ${action} completed`,
      data,
    };
  }
}
