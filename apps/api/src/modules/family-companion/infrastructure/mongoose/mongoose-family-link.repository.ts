import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import { AuditLog } from '../../../platform-audit/public-api';
import { User, UserDocument } from '../../../users/public-api';
import { UserRole, AccountStatus } from '../../../../core/domain/user.enums';
import { FamilyLink, FamilyLinkDocument } from './family-link.schema';
import {
  FamilyPermission,
  FamilyPermissionDocument,
} from './family-permission.schema';
import {
  FamilyCommandReceipt,
  FamilyCommandReceiptDocument,
} from './family-command-receipt.schema';
import {
  FamilyPolicyError,
  assertFamilyLinkLimit,
  assertPatientAccount,
  isReminderPermission,
} from '../../domain/policies/family-companion.policy';
import { transitionFamilyLink } from '../../domain/entities/family-link-lifecycle';
import type { FamilyReminderPermission } from '../../domain/policies/family-companion.policy';
import type {
  FamilyInvitationWorkflowResult,
  FamilyLinkRepository,
} from '../../application/ports/family-link.repository';
import type { FamilyLinkParticipantProfile } from '../../application/ports/family-link-read.repository';

@Injectable()
export class MongooseFamilyLinkRepository implements FamilyLinkRepository {
  constructor(
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
    @InjectModel(FamilyPermission.name)
    private readonly permissions: Model<FamilyPermissionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectModel(FamilyCommandReceipt.name)
    private readonly receipts: Model<FamilyCommandReceiptDocument>,
    private readonly outbox: OutboxService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findAcceptedInvitationReplay(
    userId: string,
    linkId: string,
    command: {
      consentVersion: string;
      permissions: FamilyReminderPermission[];
    },
    idempotencyKey: string,
  ) {
    const link = await this.links
      .findOne({
        _id: new Types.ObjectId(linkId),
        familyUserId: new Types.ObjectId(userId),
        status: 'active',
      })
      .select('invitationVersion')
      .lean()
      .exec();
    if (!link) return null;
    return this.findCommandReplay<FamilyInvitationWorkflowResult>(
      userId,
      'accept_invitation',
      idempotencyKey,
      {
        linkId,
        invitationVersion: link.invitationVersion,
        consentVersion: command.consentVersion,
        permissions: [...command.permissions].sort(),
      },
    );
  }

  async findPendingInvitationOwner(userId: string, linkId: string) {
    const link = await this.links
      .findOne({
        _id: new Types.ObjectId(linkId),
        status: 'pending',
        invitationExpiresAt: { $gt: new Date() },
        $or: [
          { familyUserId: new Types.ObjectId(userId) },
          {
            familyUserId: { $exists: false },
            pendingRedeemerUserId: new Types.ObjectId(userId),
          },
        ],
      })
      .select('patientId invitationVersion')
      .lean()
      .exec();
    return link
      ? {
          patientId: String(link.patientId),
          invitationVersion: link.invitationVersion,
        }
      : null;
  }

  async redeemInvitation(
    userId: string,
    dto: { invitationTokenHash?: string; shortCodeHash?: string },
    idempotencyKey: string,
  ) {
    this.requireId(userId);
    this.requireIdempotency(idempotencyKey);
    if (
      (!dto.invitationTokenHash && !dto.shortCodeHash) ||
      (dto.invitationTokenHash && dto.shortCodeHash)
    )
      throw new BadRequestException('INVITATION_TOKEN_OR_CODE_REQUIRED');
    const user = await this.users.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('Patient not found');
    this.assertPatient(user);
    const now = new Date();
    const isShortCode = Boolean(dto.shortCodeHash);
    const request = {
      invitationTokenHash: dto.invitationTokenHash ?? null,
      shortCodeHash: dto.shortCodeHash ?? null,
    };
    const replay = await this.findCommandReplay<FamilyInvitationWorkflowResult>(
      userId,
      'redeem_invitation',
      idempotencyKey,
      request,
    );
    if (replay) return replay;
    const filter = dto.invitationTokenHash
      ? { invitationTokenHash: dto.invitationTokenHash }
      : {
          shortCodeHash: dto.shortCodeHash,
          shortCodeExpiresAt: { $gt: now },
          shortCodeLockedUntil: { $not: { $gt: now } },
        };
    const link = await this.links
      .findOne({
        ...filter,
        status: 'pending',
        invitationExpiresAt: { $gt: now },
      })
      .select('+invitationTokenHash +shortCodeHash')
      .exec();
    if (!link) {
      if (isShortCode) {
        const candidate = await this.links
          .findOne({
            shortCodeHash: dto.shortCodeHash,
            status: 'pending',
          })
          .select('+shortCodeHash')
          .exec();
        if (
          candidate &&
          (!candidate.shortCodeLockedUntil ||
            candidate.shortCodeLockedUntil <= now)
        ) {
          candidate.shortCodeFailedAttempts =
            (candidate.shortCodeFailedAttempts ?? 0) + 1;
          if (candidate.shortCodeFailedAttempts >= 5)
            candidate.shortCodeLockedUntil = new Date(
              now.getTime() + 15 * 60_000,
            );
          await candidate.save();
        }
      }
      throw new BadRequestException('INVITATION_NOT_FOUND_OR_EXPIRED');
    }
    if (link.familyUserId && String(link.familyUserId) !== userId)
      throw new ForbiddenException('INVITATION_RECIPIENT_MISMATCH');
    if (String(link.patientId) === userId)
      throw new BadRequestException('FAMILY_SELF_INVITE_NOT_ALLOWED');
    const outcome = await this.runIdempotentCommand(
      userId,
      'redeem_invitation',
      idempotencyKey,
      request,
      async (session) => {
        const updated = await this.links
          .findOneAndUpdate(
            {
              _id: link._id,
              status: 'pending',
              invitationVersion: link.invitationVersion,
              invitationExpiresAt: { $gt: now },
              ...(isShortCode
                ? {
                    shortCodeHash: dto.shortCodeHash,
                    shortCodeExpiresAt: { $gt: now },
                    shortCodeLockedUntil: { $not: { $gt: now } },
                  }
                : { invitationTokenHash: dto.invitationTokenHash }),
            },
            {
              $set: {
                pendingRedeemerUserId: new Types.ObjectId(userId),
                pendingRedeemedAt: now,
              },
              ...(isShortCode
                ? { $unset: { shortCodeHash: '', shortCodeExpiresAt: '' } }
                : {}),
            },
            { returnDocument: 'after', session },
          )
          .exec();
        if (!updated)
          throw new BadRequestException('INVITATION_NOT_FOUND_OR_EXPIRED');
        const counterparty = await this.loadParticipantProfile(
          updated.patientId,
          session,
        );
        return this.toProjection(updated, counterparty);
      },
    );
    return outcome.result;
  }

  async acceptInvitation(
    userId: string,
    linkId: string,
    dto: { consentVersion: string; permissions: FamilyReminderPermission[] },
    idempotencyKey: string,
    currentFamilyLinkLimit: number,
    invitationVersion: number,
  ) {
    this.requireId(linkId);
    this.requireIdempotency(idempotencyKey);
    const now = new Date();
    const outcome = await this.runIdempotentCommand(
      userId,
      'accept_invitation',
      idempotencyKey,
      {
        linkId,
        invitationVersion,
        consentVersion: dto.consentVersion,
        permissions: [...dto.permissions].sort(),
      },
      async (session) => {
        const link = await this.links
          .findOne({
            _id: linkId,
            status: 'pending',
            invitationVersion,
            invitationExpiresAt: { $gt: now },
          })
          .session(session)
          .exec();
        if (!link) throw new NotFoundException('Invitation not found');
        if (
          link.familyUserId &&
          String(link.familyUserId) !== userId &&
          String(link.pendingRedeemerUserId) !== userId
        )
          throw new ForbiddenException('INVITATION_RECIPIENT_MISMATCH');
        if (!link.familyUserId && String(link.pendingRedeemerUserId) !== userId)
          throw new ForbiddenException('INVITATION_REDEEM_REQUIRED');
        // Serialize accepts for the same patient so two pending invitations cannot
        // both observe an available slot and exceed the current limit.
        const ownerLock = await this.users.updateOne(
          { _id: link.patientId },
          { $inc: { __v: 1 } },
          { session },
        );
        if (ownerLock.matchedCount !== 1)
          throw new NotFoundException('Patient not found');
        const activeCount = await this.links
          .countDocuments({ patientId: link.patientId, status: 'active' })
          .session(session)
          .exec();
        const contact = await this.users
          .findById(userId)
          .session(session)
          .lean()
          .exec();
        if (!contact) throw new NotFoundException('Patient not found');
        this.assertPatient(contact);
        const permissions = this.normalizePermissions(dto.permissions);
        try {
          if (
            !Number.isInteger(currentFamilyLinkLimit) ||
            currentFamilyLinkLimit < 1 ||
            currentFamilyLinkLimit > 10
          )
            throw new FamilyPolicyError('FAMILY_ENTITLEMENT_UNAVAILABLE');
          assertFamilyLinkLimit(currentFamilyLinkLimit, activeCount);
        } catch (error) {
          this.mapPolicyError(error);
        }
        let acceptance: ReturnType<typeof transitionFamilyLink>;
        try {
          acceptance = transitionFamilyLink({
            link: {
              status: link.status,
              patientId: String(link.patientId),
              familyUserId: link.familyUserId
                ? String(link.familyUserId)
                : undefined,
              pendingRedeemerUserId: link.pendingRedeemerUserId
                ? String(link.pendingRedeemerUserId)
                : undefined,
            },
            action: 'accept',
            actorId: userId,
            now,
          });
        } catch (error) {
          if (error instanceof FamilyPolicyError) {
            if (error.code === 'FAMILY_INVALID_STATE_TRANSITION')
              throw new BadRequestException(error.code);
            throw new ForbiddenException(error.code);
          }
          throw error;
        }
        link.familyUserId = new Types.ObjectId(userId);
        Object.assign(link, acceptance!);
        link.consentVersion = dto.consentVersion;
        link.permissions = permissions;
        link.pendingRedeemerUserId = undefined;
        link.pendingRedeemedAt = undefined;
        await link.save({ session });
        const permission = await this.permissions.create(
          [
            {
              patientId: link.patientId,
              familyLinkId: link._id,
              policyVersion: dto.consentVersion,
              permissions,
              status: 'active',
              grantedBy: link.patientId,
              grantedAt: now,
            },
          ],
          { session },
        );
        await this.audit(
          link,
          new Types.ObjectId(userId),
          'family_invitation_accepted',
          session,
          'pending',
          'active',
        );
        await this.outbox.enqueue(
          {
            eventType: 'family.link.accepted.v1',
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: `family.link.accepted.${String(link._id)}.${link.invitationVersion}`,
            payload: {
              familyLinkId: String(link._id),
              patientId: String(link.patientId),
              familyUserId: userId,
              permissionId: String(permission[0]._id),
            },
          },
          session,
        );
        const counterparty = await this.loadParticipantProfile(
          link.patientId,
          session,
        );
        return this.toProjection(link, counterparty);
      },
    );
    return outcome.result;
  }

  async rejectInvitation(
    userId: string,
    linkId: string,
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    return this.transition(userId, linkId, 'decline', reason, idempotencyKey);
  }

  async changeFamilyLinkStatus(
    userId: string,
    linkId: string,
    action: 'pause' | 'resume' | 'revoke',
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    return this.transition(userId, linkId, action, reason, idempotencyKey);
  }

  private async transition(
    userId: string,
    linkId: string,
    action: 'decline' | 'pause' | 'resume' | 'revoke',
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    this.requireId(linkId);
    this.requireIdempotency(idempotencyKey);
    const outcome = await this.runIdempotentCommand(
      userId,
      `${action}_family_link`,
      idempotencyKey,
      { linkId, reason: reason?.slice(0, 160) ?? null },
      async (session) => {
        const link = await this.links.findById(linkId).session(session).exec();
        if (!link) throw new NotFoundException('Family link not found');
        const previous = link.status;
        const now = new Date();
        let transition: ReturnType<typeof transitionFamilyLink>;
        try {
          transition = transitionFamilyLink({
            link: {
              status: link.status,
              patientId: String(link.patientId),
              familyUserId: link.familyUserId
                ? String(link.familyUserId)
                : undefined,
              pendingRedeemerUserId: link.pendingRedeemerUserId
                ? String(link.pendingRedeemerUserId)
                : undefined,
            },
            action,
            actorId: userId,
            reason,
            now,
          });
        } catch (error) {
          if (error instanceof FamilyPolicyError) {
            if (error.code === 'FAMILY_INVALID_STATE_TRANSITION')
              throw new BadRequestException(error.code);
            throw new ForbiddenException(error.code);
          }
          throw error;
        }
        Object.assign(link, {
          ...transition,
          ...(transition.pausedBy
            ? { pausedBy: new Types.ObjectId(userId) }
            : {}),
          ...(transition.resumedBy
            ? { resumedBy: new Types.ObjectId(userId) }
            : {}),
          ...(transition.revokedBy
            ? { revokedBy: new Types.ObjectId(userId) }
            : {}),
        });
        await link.save({ session });
        if (action === 'revoke' || action === 'decline') {
          await this.permissions.updateMany(
            { familyLinkId: link._id, status: 'active' },
            {
              $set: {
                status: 'revoked',
                revokedAt: now,
                revokedBy: new Types.ObjectId(userId),
                revokeReason: reason?.slice(0, 160),
              },
            },
            { session },
          );
        }
        if (action === 'revoke') {
          await this.connection
            .collection('familyhealthmetricsharings')
            .updateMany(
              {
                familyLinkId: link._id,
                invitationVersion: link.invitationVersion,
                status: 'active',
              },
              {
                $set: {
                  status: 'revoked',
                  revokedAt: now,
                  revokedBy: new Types.ObjectId(userId),
                },
              },
              { session },
            );
        }
        await this.audit(
          link,
          new Types.ObjectId(userId),
          `family_link_${action}`,
          session,
          previous,
          link.status,
        );
        await this.outbox.enqueue(
          {
            eventType: `family.link.${action}.v1`,
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: `family.link.${action}.${String(link._id)}.${link.updatedAt?.getTime() ?? now.getTime()}`,
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
        const isOwner = String(link.patientId) === userId;
        const counterparty = await this.loadParticipantProfile(
          isOwner ? link.familyUserId : link.patientId,
          session,
        );
        return this.toProjection(link, counterparty);
      },
    );
    return outcome.result;
  }

  async updatePermissions(
    userId: string,
    linkId: string,
    dto: { permissions: FamilyReminderPermission[]; policyVersion: string },
    idempotencyKey: string,
  ) {
    this.requireId(linkId);
    this.requireIdempotency(idempotencyKey);
    const permissions = this.normalizePermissions(dto.permissions);
    const now = new Date();
    const outcome = await this.runIdempotentCommand(
      userId,
      'update_reminder_permissions',
      idempotencyKey,
      { linkId, permissions, policyVersion: dto.policyVersion },
      async (session) => {
        const link = await this.links
          .findOne({
            _id: new Types.ObjectId(linkId),
            patientId: new Types.ObjectId(userId),
            status: { $in: ['active', 'paused'] },
          })
          .session(session)
          .exec();
        if (!link) throw new NotFoundException('Family link not found');
        link.permissions = permissions;
        link.consentVersion = dto.policyVersion;
        await link.save({ session });
        await this.permissions.updateMany(
          { familyLinkId: link._id, status: 'active' },
          {
            $set: {
              status: 'revoked',
              revokedAt: now,
              revokedBy: new Types.ObjectId(userId),
              revokeReason: 'permission_changed',
            },
          },
          { session },
        );
        await this.permissions.create(
          [
            {
              patientId: link.patientId,
              familyLinkId: link._id,
              policyVersion: dto.policyVersion,
              permissions,
              status: 'active',
              grantedBy: link.patientId,
              grantedAt: now,
            },
          ],
          { session },
        );
        await this.audit(
          link,
          new Types.ObjectId(userId),
          'family_permission_changed',
          session,
        );
        await this.outbox.enqueue(
          {
            eventType: 'family.permission.changed.v1',
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: `family.permission.changed.${String(link._id)}.${now.getTime()}`,
            payload: {
              familyLinkId: String(link._id),
              patientId: String(link.patientId),
            },
          },
          session,
        );
        const counterparty = await this.loadParticipantProfile(
          link.familyUserId,
          session,
        );
        return this.toProjection(link, counterparty);
      },
    );
    return outcome.result;
  }

  async regenerateArtifacts(
    userId: string,
    linkId: string,
    idempotencyKey: string,
    artifacts: {
      invitationTokenHash: string;
      shortCodeHash: string;
      shortCodeExpiresAt: Date;
      invitationExpiresAt: Date;
    },
  ) {
    this.requireId(linkId);
    this.requireIdempotency(idempotencyKey);
    return this.runIdempotentCommand(
      userId,
      'regenerate_invitation_artifacts',
      idempotencyKey,
      { linkId },
      async (session) => {
        const link = await this.links
          .findOne({
            _id: new Types.ObjectId(linkId),
            patientId: new Types.ObjectId(userId),
            status: 'pending',
          })
          .select('+invitationTokenHash +shortCodeHash')
          .session(session)
          .exec();
        if (!link)
          throw new NotFoundException('Pending family invitation not found');
        link.invitationTokenHash = artifacts.invitationTokenHash;
        link.shortCodeHash = artifacts.shortCodeHash;
        link.shortCodeExpiresAt = artifacts.shortCodeExpiresAt;
        link.invitationExpiresAt = artifacts.invitationExpiresAt;
        link.invitationVersion += 1;
        link.pendingRedeemerUserId = undefined;
        link.pendingRedeemedAt = undefined;
        link.shortCodeFailedAttempts = 0;
        link.shortCodeLockedUntil = undefined;
        await link.save({ session });
        await this.audit(
          link,
          new Types.ObjectId(userId),
          'family_invitation_artifacts_regenerated',
          session,
        );
        await this.outbox.enqueue(
          {
            eventType: 'family.invitation.artifacts-regenerated.v1',
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: `family.invitation.artifacts-regenerated.${String(link._id)}.${link.invitationVersion}`,
            payload: {
              familyLinkId: String(link._id),
              patientId: String(link.patientId),
              invitationVersion: link.invitationVersion,
            },
          },
          session,
        );
        return this.toProjection(link);
      },
    );
  }

  /** Expires pending invitations in bounded batches; invoked by the worker. */
  async expirePendingInvitations(now = new Date()) {
    const candidates = await this.links
      .find({ status: 'pending', invitationExpiresAt: { $lte: now } })
      .sort({ invitationExpiresAt: 1, _id: 1 })
      .limit(100)
      .exec();
    let expired = 0;
    for (const candidate of candidates) {
      await this.connection.transaction(async (session) => {
        const link = await this.links
          .findOne({
            _id: candidate._id,
            status: 'pending',
            invitationExpiresAt: { $lte: now },
          })
          .session(session)
          .exec();
        if (!link) return;
        link.status = 'expired';
        link.expiredAt = now;
        await link.save({ session });
        await this.audit(
          link,
          link.patientId,
          'family_invitation_expired',
          session,
          'pending',
          'expired',
        );
        await this.outbox.enqueue(
          {
            eventType: 'family.invitation.expired.v1',
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: `family.invitation.expired.${String(link._id)}.${link.invitationVersion}`,
            payload: {
              familyLinkId: String(link._id),
              patientId: String(link.patientId),
            },
          },
          session,
        );
        expired += 1;
      });
    }
    return expired;
  }

  private async runIdempotentCommand<T>(
    actorId: string,
    operation: string,
    idempotencyKey: string,
    command: Record<string, unknown>,
    work: (session: ClientSession) => Promise<T>,
  ): Promise<{ result: T; replayed: boolean }> {
    const actor = new Types.ObjectId(actorId);
    const keyHash = this.hash(idempotencyKey.trim());
    const requestHash = this.hash(JSON.stringify(command));
    const receiptFilter = { actorId: actor, operation, keyHash };
    try {
      return await this.connection.transaction(async (session) => {
        const previous = await this.readCommandReceipt<T>(
          receiptFilter,
          requestHash,
          session,
        );
        if (previous !== null) return { result: previous, replayed: true };
        const result = await work(session);
        await this.receipts.create(
          [
            {
              ...receiptFilter,
              requestHash,
              result: result as Record<string, unknown>,
            },
          ],
          { session },
        );
        return { result, replayed: false };
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const previous = await this.readCommandReceipt<T>(
        receiptFilter,
        requestHash,
      );
      if (previous === null) throw error;
      return { result: previous, replayed: true };
    }
  }

  private async findCommandReplay<T>(
    actorId: string,
    operation: string,
    idempotencyKey: string,
    command: Record<string, unknown>,
  ): Promise<T | null> {
    return this.readCommandReceipt<T>(
      {
        actorId: new Types.ObjectId(actorId),
        operation,
        keyHash: this.hash(idempotencyKey.trim()),
      },
      this.hash(JSON.stringify(command)),
    );
  }

  private async readCommandReceipt<T>(
    filter: { actorId: Types.ObjectId; operation: string; keyHash: string },
    requestHash: string,
    session?: ClientSession,
  ): Promise<T | null> {
    let query = this.receipts.findOne(filter);
    if (session) query = query.session(session);
    const receipt = await query.lean().exec();
    if (!receipt) return null;
    if (receipt.requestHash !== requestHash)
      throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
    return receipt.result as T;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async loadParticipantProfile(
    userId: Types.ObjectId | undefined,
    session?: ClientSession,
  ): Promise<FamilyLinkParticipantProfile | null> {
    if (!userId) return null;
    let query = this.users
      .findById(userId)
      .select('_id fullName email avatarUrl');
    if (session) query = query.session(session);
    const doc = await query.lean().exec();
    if (!doc?.fullName) return null;
    return {
      fullName: doc.fullName,
      ...(doc.email ? { email: doc.email } : {}),
      ...(doc.avatarUrl ? { avatarUrl: doc.avatarUrl } : {}),
    };
  }

  private toProjection(
    link: FamilyLinkDocument | (FamilyLink & { _id: Types.ObjectId }),
    counterparty?: FamilyLinkParticipantProfile | null,
  ) {
    return {
      id: String(link._id),
      patientId: String(link.patientId),
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
      allowedActions: this.allowedActions(link.status),
      ...(counterparty !== undefined ? { counterparty } : {}),
    };
  }

  private allowedActions(status: string) {
    return status === 'pending'
      ? ['accept', 'decline', 'revoke']
      : status === 'active'
        ? ['pause', 'revoke']
        : status === 'paused'
          ? ['resume', 'revoke']
          : [];
  }

  private normalizePermissions(values: unknown): FamilyReminderPermission[] {
    if (
      !Array.isArray(values) ||
      values.some((value) => !isReminderPermission(value))
    )
      throw new BadRequestException('INVALID_FAMILY_PERMISSIONS');
    return [...new Set(values)] as FamilyReminderPermission[];
  }

  private assertPatient(user: {
    role: UserRole;
    accountStatus: AccountStatus;
    emailVerifiedAt?: Date | null;
  }) {
    try {
      assertPatientAccount(user.role, user.accountStatus, user.emailVerifiedAt);
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

  private async audit(
    link: FamilyLinkDocument,
    actorId: Types.ObjectId,
    action: string,
    session?: import('mongoose').ClientSession,
    fromStatus?: string,
    toStatus?: string,
  ) {
    const write = this.audits.create(
      [
        {
          domain: 'care',
          entityType: 'FamilyLink',
          entityId: link._id,
          actorId,
          userId: link.patientId,
          action,
          fromStatus,
          toStatus,
          metadata: {
            invitationVersion: link.invitationVersion,
            permissionCount: link.permissions?.length ?? 0,
          },
        },
      ],
      session ? { session } : undefined,
    );
    await write;
  }

  private requireId(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException('INVALID_ID');
  }
  private requireIdempotency(value: string) {
    if (!value?.trim())
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
  }
}
