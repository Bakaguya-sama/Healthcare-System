import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { AccountStatus, UserRole } from '../../../../core/domain/user.enums';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import { FreeSubscriptionGrantService } from '../../../billing/public-api';
import { AuditLog } from '../../../platform-audit/public-api';
import { User, UserDocument } from '../../../users/public-api';
import type {
  FamilyInvitationCreationStore,
  FamilyInvitationRecord,
  SaveFamilyInvitationInput,
} from '../../application/ports/family-invitation-creation.port';
import { FamilyLink, FamilyLinkDocument } from './family-link.schema';

@Injectable()
export class MongooseFamilyInvitationCreationStore implements FamilyInvitationCreationStore {
  constructor(
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    private readonly grants: FreeSubscriptionGrantService,
    private readonly outbox: OutboxService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findPatient(patientId: string) {
    if (!Types.ObjectId.isValid(patientId)) return null;
    const patient = await this.users.findById(patientId).lean().exec();
    return patient
      ? {
          id: String(patient._id),
          role: patient.role,
          accountStatus: patient.accountStatus,
          emailVerifiedAt: patient.emailVerifiedAt,
        }
      : null;
  }

  async findEligibleContact(contactUserId: string) {
    if (!Types.ObjectId.isValid(contactUserId)) return null;
    const contact = await this.users
      .findOne({
        _id: new Types.ObjectId(contactUserId),
        role: UserRole.PATIENT,
        accountStatus: AccountStatus.ACTIVE,
        emailVerifiedAt: { $ne: null },
      })
      .select('_id role accountStatus emailVerifiedAt')
      .lean()
      .exec();
    return contact
      ? {
          id: String(contact._id),
          role: contact.role,
          accountStatus: contact.accountStatus,
          emailVerifiedAt: contact.emailVerifiedAt,
        }
      : null;
  }

  async getEntitlement(patientId: string) {
    const subscription = await this.grants.getEffectiveSubscription(patientId);
    return {
      subscriptionId: subscription?._id ? String(subscription._id) : undefined,
      familyLinkLimit: Number(subscription?.planSnapshot?.familyLinkLimit ?? 0),
    };
  }

  async findByIdempotencyKey(
    patientId: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const link = await this.links
      .findOne({ patientId: new Types.ObjectId(patientId), idempotencyKey })
      .select('+idempotencyRequestHash')
      .lean()
      .exec();
    if (
      link?.idempotencyRequestHash &&
      link.idempotencyRequestHash !== requestHash
    )
      throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
    return link ? this.map(link) : null;
  }

  countActiveLinks(patientId: string) {
    return this.links
      .countDocuments({
        patientId: new Types.ObjectId(patientId),
        status: 'active',
      })
      .exec();
  }

  async findOpenLink(patientId: string, familyUserId: string) {
    const link = await this.links
      .findOne({
        patientId: new Types.ObjectId(patientId),
        familyUserId: new Types.ObjectId(familyUserId),
        status: { $in: ['pending', 'active', 'paused'] },
      })
      .lean()
      .exec();
    return link ? this.map(link) : null;
  }

  async findReusableLink(patientId: string, familyUserId: string) {
    const link = await this.links
      .findOne({
        patientId: new Types.ObjectId(patientId),
        familyUserId: new Types.ObjectId(familyUserId),
        status: { $in: ['declined', 'expired', 'revoked'] },
      })
      .lean()
      .exec();
    return link ? this.map(link) : null;
  }

  async saveWithAuditAndOutbox(input: SaveFamilyInvitationInput) {
    return this.connection.transaction(async (session) => {
      const link = input.reusableLinkId
        ? await this.links
            .findById(input.reusableLinkId)
            .select('+invitationTokenHash +shortCodeHash')
            .session(session)
            .exec()
        : new this.links();
      if (!link) throw new Error('FAMILY_REUSABLE_LINK_NOT_FOUND');
      link.patientId = new Types.ObjectId(input.patientId);
      link.familyUserId = input.familyUserId
        ? new Types.ObjectId(input.familyUserId)
        : undefined;
      link.relationship = input.relationship;
      link.status = 'pending';
      link.invitationVersion = input.invitationVersion;
      link.idempotencyKey = input.idempotencyKey;
      link.idempotencyRequestHash = input.idempotencyRequestHash;
      link.invitationDelivery = input.invitationDelivery;
      link.invitationTokenHash = input.invitationTokenHash;
      link.shortCodeHash = input.shortCodeHash;
      link.shortCodeExpiresAt = input.shortCodeExpiresAt;
      link.shortCodeFailedAttempts = 0;
      link.shortCodeLockedUntil = undefined;
      link.invitedAt = input.invitedAt;
      link.invitationExpiresAt = input.invitationExpiresAt;
      link.acceptedAt = undefined;
      link.declinedAt = undefined;
      link.expiredAt = undefined;
      link.revokedAt = undefined;
      link.pendingRedeemerUserId = undefined;
      link.pendingRedeemedAt = undefined;
      link.consentVersion = undefined;
      link.permissions = [];
      link.entitlementSubscriptionId = input.entitlementSubscriptionId
        ? new Types.ObjectId(input.entitlementSubscriptionId)
        : undefined;
      link.entitlementFamilyLinkLimit = input.entitlementFamilyLinkLimit;
      await link.save({ session });
      await this.audits.create(
        [
          {
            domain: 'care',
            entityType: 'FamilyLink',
            entityId: link._id,
            actorId: link.patientId,
            userId: link.patientId,
            action: input.reusableLinkId
              ? 'family_invitation_reinvited'
              : 'family_invitation_created',
            metadata: {
              invitationVersion: link.invitationVersion,
              permissionCount: 0,
            },
          },
        ],
        { session },
      );
      await this.outbox.enqueue(
        {
          eventType: 'family.invitation.created.v1',
          aggregateType: 'FamilyLink',
          aggregateId: link._id,
          idempotencyKey: `family.invitation.created.${String(link._id)}.${link.invitationVersion}`,
          payload: {
            familyLinkId: String(link._id),
            patientId: String(link.patientId),
            familyUserId: link.familyUserId
              ? String(link.familyUserId)
              : undefined,
          },
        },
        session,
      );
      return this.map(link);
    });
  }

  private map(link: FamilyLink & { _id: unknown }): FamilyInvitationRecord {
    return {
      id: String(link._id),
      patientId: String(link.patientId),
      familyUserId: link.familyUserId ? String(link.familyUserId) : undefined,
      relationship: link.relationship,
      status: link.status,
      invitationVersion: link.invitationVersion,
      invitationDelivery: link.invitationDelivery,
      invitationExpiresAt: link.invitationExpiresAt,
      shortCodeExpiresAt: link.shortCodeExpiresAt,
      permissions: link.permissions,
      consentVersion: link.consentVersion,
      invitedAt: link.invitedAt,
      acceptedAt: link.acceptedAt,
      pausedAt: link.pausedAt,
      resumedAt: link.resumedAt,
      declinedAt: link.declinedAt,
      expiredAt: link.expiredAt,
      revokedAt: link.revokedAt,
    };
  }
}
