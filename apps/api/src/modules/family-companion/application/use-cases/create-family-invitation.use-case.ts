import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt } from 'crypto';
import { FamilyInvitation } from '../../domain/entities/family-link.entity';
import {
  FAMILY_INVITATION_DAYS,
  FAMILY_MAX_LINKS,
  FAMILY_SHORT_CODE_MINUTES,
  FamilyPolicyError,
  assertFamilyLinkLimit,
  assertNotSelf,
  assertPatientAccount,
} from '../../domain/policies/family-companion.policy';
import { FAMILY_INVITATION_CREATION_STORE } from '../ports/family-invitation-creation.port';
import type {
  FamilyInvitationCreationStore,
  FamilyInvitationRecord,
} from '../ports/family-invitation-creation.port';

export interface CreateFamilyInvitationCommand {
  contactUserId?: string;
  share?: boolean;
  relationship?: string;
}

@Injectable()
export class CreateFamilyInvitation {
  constructor(
    @Inject(FAMILY_INVITATION_CREATION_STORE)
    private readonly invitations: FamilyInvitationCreationStore,
    private readonly config: ConfigService,
  ) {}

  async execute(
    patientId: string,
    command: CreateFamilyInvitationCommand,
    idempotencyKey: string,
  ) {
    this.assertEnabled();
    if (!idempotencyKey?.trim())
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    if (Boolean(command.contactUserId) === Boolean(command.share))
      throw new BadRequestException('CONTACT_USER_ID_OR_SHARE_REQUIRED');
    const patient = await this.invitations.findPatient(patientId);
    if (!patient) throw new NotFoundException('Patient not found');
    this.applyPolicy(() =>
      assertPatientAccount(
        patient.role,
        patient.accountStatus,
        patient.emailVerifiedAt,
      ),
    );
    const requestHash = this.hash(
      JSON.stringify({
        contactUserId: command.contactUserId ?? null,
        share: command.share === true,
        relationship: command.relationship?.trim() || null,
      }),
    );
    const replay = await this.invitations.findByIdempotencyKey(
      patientId,
      idempotencyKey.trim(),
      requestHash,
    );
    if (replay) return this.response(replay);

    const entitlement = await this.invitations.getEntitlement(patientId);
    const limit = this.normalizeLimit(entitlement.familyLinkLimit);
    const activeLinkCount = await this.invitations.countActiveLinks(patientId);
    this.applyPolicy(() => assertFamilyLinkLimit(limit, activeLinkCount));

    let familyUserId: string | undefined;
    if (command.contactUserId) {
      if (!/^[a-f\d]{24}$/i.test(command.contactUserId))
        throw new BadRequestException('INVALID_CONTACT_USER_ID');
      const contact = await this.invitations.findEligibleContact(
        command.contactUserId,
      );
      if (!contact)
        throw new BadRequestException('FAMILY_CONTACT_NOT_ELIGIBLE');
      familyUserId = contact.id;
    }

    let reusable: FamilyInvitationRecord | null = null;
    if (familyUserId) {
      const matchedFamilyUserId = familyUserId;
      this.applyPolicy(() => assertNotSelf(patientId, matchedFamilyUserId));
      if (await this.invitations.findOpenLink(patientId, matchedFamilyUserId))
        throw new ConflictException('FAMILY_LINK_ALREADY_EXISTS');
      reusable = await this.invitations.findReusableLink(
        patientId,
        matchedFamilyUserId,
      );
      if (reusable) FamilyInvitation.assertCanRenew(reusable.status);
    }

    const token = randomBytes(32).toString('base64url');
    const shortCode = String(randomInt(100000, 1_000_000));
    const invitation = FamilyInvitation.issue({
      patientId,
      familyUserId,
      relationship: command.relationship,
      now: new Date(),
      invitationDays: FAMILY_INVITATION_DAYS,
      shortCodeMinutes: FAMILY_SHORT_CODE_MINUTES,
    });
    try {
      const saved = await this.invitations.saveWithAuditAndOutbox({
        reusableLinkId: reusable?.id,
        patientId,
        familyUserId,
        relationship: invitation.relationship,
        idempotencyKey: idempotencyKey.trim(),
        idempotencyRequestHash: requestHash,
        invitationVersion: reusable
          ? reusable.invitationVersion + 1
          : invitation.invitationVersion,
        invitationDelivery: invitation.invitationDelivery,
        invitationTokenHash: this.hash(token),
        shortCodeHash: this.hash(shortCode),
        shortCodeExpiresAt: invitation.shortCodeExpiresAt,
        invitedAt: invitation.invitedAt,
        invitationExpiresAt: invitation.invitationExpiresAt,
        entitlementSubscriptionId: entitlement.subscriptionId,
        entitlementFamilyLinkLimit: limit,
      });
      return this.response(saved, { token, shortCode });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const concurrentReplay = await this.invitations.findByIdempotencyKey(
          patientId,
          idempotencyKey.trim(),
          requestHash,
        );
        if (concurrentReplay) return this.response(concurrentReplay);
        throw new ConflictException('FAMILY_INVITATION_CONFLICT');
      }
      throw error;
    }
  }

  private response(
    invitation: FamilyInvitationRecord,
    artifacts?: { token: string; shortCode: string },
  ) {
    const link = {
      id: invitation.id,
      patientId: invitation.patientId,
      relationship: invitation.relationship,
      status: invitation.status,
      invitationVersion: invitation.invitationVersion,
      invitationDelivery: invitation.invitationDelivery,
      invitationExpiresAt: invitation.invitationExpiresAt,
      shortCodeExpiresAt: invitation.shortCodeExpiresAt,
      permissions: invitation.permissions,
      consentVersion: invitation.consentVersion,
      invitedAt: invitation.invitedAt,
      acceptedAt: invitation.acceptedAt,
      pausedAt: invitation.pausedAt,
      resumedAt: invitation.resumedAt,
      declinedAt: invitation.declinedAt,
      expiredAt: invitation.expiredAt,
      revokedAt: invitation.revokedAt,
      allowedActions:
        invitation.status === 'pending'
          ? ['accept', 'decline', 'revoke']
          : invitation.status === 'active'
            ? ['pause', 'revoke']
            : invitation.status === 'paused'
              ? ['resume', 'revoke']
              : [],
    };
    if (!artifacts)
      return {
        statusCode: 200,
        message: 'Family invitation already created',
        data: {
          link,
          artifacts: {
            familyLinkId: invitation.id,
            revealOnce: true,
            available: false,
          },
        },
      };
    const baseUrl =
      this.config.get<string>('FAMILY_INVITATION_BASE_URL') ??
      'http://localhost:5173/family-links/redeem?token=';
    const shareLink = `${baseUrl}${encodeURIComponent(artifacts.token)}`;
    return {
      statusCode: 201,
      message: 'Family invitation created',
      data: {
        link,
        artifacts: {
          familyLinkId: invitation.id,
          shareLink,
          qrPayload: shareLink,
          shortCode: artifacts.shortCode,
          shortCodeExpiresAt: invitation.shortCodeExpiresAt,
          invitationExpiresAt: invitation.invitationExpiresAt,
          revealOnce: true,
        },
      },
    };
  }

  private normalizeLimit(value: unknown) {
    const limit = Number(value);
    return Number.isInteger(limit) && limit >= 0 && limit <= FAMILY_MAX_LINKS
      ? limit
      : 0;
  }

  private applyPolicy(action: () => void) {
    try {
      action();
    } catch (error) {
      this.mapPolicyError(error);
    }
  }

  private mapPolicyError(error: unknown): never {
    if (error instanceof FamilyPolicyError) {
      if (
        error.code.endsWith('LIMIT_REACHED') ||
        error.code.includes('ENTITLEMENT')
      )
        throw new ForbiddenException(error.code);
      throw new BadRequestException(error.code);
    }
    throw error;
  }

  private assertEnabled() {
    if (this.config.get<boolean>('FAMILY_COMPANION_ENABLED') !== true)
      throw new ForbiddenException('FAMILY_COMPANION_DISABLED');
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
