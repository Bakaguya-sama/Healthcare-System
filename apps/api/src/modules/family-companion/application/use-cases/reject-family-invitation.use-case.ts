import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class RejectFamilyInvitation {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(
    contactUserId: string,
    familyLinkId: string,
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(contactUserId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    const data = await this.invitations.rejectInvitation(
      contactUserId,
      familyLinkId,
      reason,
      idempotencyKey.trim(),
    );
    return { statusCode: 200, message: 'Family link decline completed', data };
  }
}
