import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt } from 'crypto';
import {
  FAMILY_INVITATION_DAYS,
  FAMILY_SHORT_CODE_MINUTES,
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

@Injectable()
export class RegenerateFamilyInvitationArtifacts {
  constructor(
    @Inject(FAMILY_LINK_REPOSITORY)
    private readonly invitations: FamilyLinkRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(
    patientId: string,
    familyLinkId: string,
    idempotencyKey: string,
  ) {
    assertFamilyCompanionEnabled(this.config);
    assertValidFamilyId(patientId);
    assertValidFamilyId(familyLinkId);
    assertFamilyIdempotencyKey(idempotencyKey);
    const token = randomBytes(32).toString('base64url');
    const shortCode = String(randomInt(100000, 1_000_000));
    const now = new Date();
    const outcome = await this.invitations.regenerateArtifacts(
      patientId,
      familyLinkId,
      idempotencyKey.trim(),
      {
        invitationTokenHash: this.hash(token),
        shortCodeHash: this.hash(shortCode),
        shortCodeExpiresAt: new Date(
          now.getTime() + FAMILY_SHORT_CODE_MINUTES * 60_000,
        ),
        invitationExpiresAt: new Date(
          now.getTime() + FAMILY_INVITATION_DAYS * 86_400_000,
        ),
      },
    );
    if (outcome.replayed) {
      return {
        statusCode: 200,
        message: 'Family invitation artifacts already regenerated',
        data: {
          link: outcome.result,
          artifacts: { familyLinkId, revealOnce: true, available: false },
        },
      };
    }
    const result = outcome.result;
    const baseUrl =
      this.config.get<string>('FAMILY_INVITATION_BASE_URL') ??
      'http://localhost:5173/family-links/redeem?token=';
    const shareLink = `${baseUrl}${encodeURIComponent(token)}`;
    return {
      statusCode: 201,
      message: 'Family invitation artifacts regenerated',
      data: {
        link: result,
        artifacts: {
          familyLinkId,
          shareLink,
          qrPayload: shareLink,
          shortCode,
          shortCodeExpiresAt: result.shortCodeExpiresAt,
          invitationExpiresAt: result.invitationExpiresAt,
          revealOnce: true,
        },
      },
    };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
