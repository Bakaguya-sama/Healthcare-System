import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import { OutboxEvent } from '../../../../infrastructure/outbox/entities/outbox-event.entity';
import { AuditLog } from '../../../platform-audit/public-api';
import type { FamilyHealthMetricSharingRepository } from '../../application/ports/family-health-metric-sharing.repository';
import { FamilyLink, FamilyLinkDocument } from './family-link.schema';
import {
  FamilyHealthMetricSharing,
  FamilyHealthMetricSharingDocument,
} from './family-health-metric-sharing.schema';

@Injectable()
export class MongooseFamilyHealthMetricSharingRepository implements FamilyHealthMetricSharingRepository {
  constructor(
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
    @InjectModel(FamilyHealthMetricSharing.name)
    private readonly sharings: Model<FamilyHealthMetricSharingDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectModel(OutboxEvent.name) private readonly events: Model<OutboxEvent>,
    private readonly outbox: OutboxService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getParticipantLink(actorId: string, familyLinkId: string) {
    const link = await this.links
      .findOne({
        _id: new Types.ObjectId(familyLinkId),
        $or: [
          { patientId: new Types.ObjectId(actorId) },
          { familyUserId: new Types.ObjectId(actorId) },
        ],
      })
      .lean()
      .exec();
    return link
      ? {
          patientId: String(link.patientId),
          familyUserId: link.familyUserId
            ? String(link.familyUserId)
            : undefined,
          status: link.status,
          invitationVersion: link.invitationVersion,
        }
      : null;
  }

  async getActiveSharing(familyLinkId: string, invitationVersion: number) {
    const sharing = await this.sharings
      .findOne({
        familyLinkId: new Types.ObjectId(familyLinkId),
        invitationVersion,
        status: 'active',
      })
      .lean()
      .exec();
    if (!sharing || !['all', 'selected'].includes(sharing.scope)) return null;
    const scope =
      sharing.scope === 'all'
        ? { scope: 'all' as const }
        : { scope: 'selected' as const, metricTypes: sharing.metricTypes };
    return {
      familyUserId: String(sharing.familyUserId),
      scope,
      revision: sharing.revision,
      consentVersion: sharing.consentVersion,
      consentedAt: sharing.consentedAt,
    };
  }

  async auditRead(
    actorId: string,
    patientId: string,
    familyLinkId: string,
    action: string,
  ) {
    await this.audits.create({
      domain: 'care',
      entityType: 'FamilyLink',
      entityId: new Types.ObjectId(familyLinkId),
      actorId: new Types.ObjectId(actorId),
      userId: new Types.ObjectId(patientId),
      action,
    });
  }

  async grant(
    input: Parameters<FamilyHealthMetricSharingRepository['grant']>[0],
  ) {
    const operationKey = this.operationKey(
      input.patientId,
      input.idempotencyKey,
    );
    const fingerprint = this.hash(
      JSON.stringify({
        action: 'grant',
        link: input.familyLinkId,
        scope: input.scope,
        consent: input.consentVersion,
      }),
    );
    try {
      return await this.connection.transaction(async (session) => {
        const replay = await this.events
          .findOne({ idempotencyKey: operationKey })
          .session(session)
          .lean()
          .exec();
        if (replay) {
          if (replay.payload?.fingerprint !== fingerprint)
            throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
          return { revision: Number(replay.payload.revision) };
        }
        // Writing the link in the transaction serializes sharing changes with link revoke/pause.
        const link = await this.links
          .findOneAndUpdate(
            {
              _id: new Types.ObjectId(input.familyLinkId),
              patientId: new Types.ObjectId(input.patientId),
              status: 'active',
              familyUserId: { $type: 'objectId' },
            },
          { $set: { updatedAt: input.now }, $inc: { __v: 1 } },
            { session, returnDocument: 'after', timestamps: false },
          )
          .exec();
        if (!link?.familyUserId)
          throw new NotFoundException('ACTIVE_FAMILY_LINK_NOT_FOUND');
        const previous = await this.sharings
          .findOne({
            familyLinkId: link._id,
            invitationVersion: link.invitationVersion,
          })
          .sort({ revision: -1 })
          .session(session)
          .exec();
        if (previous?.status === 'active') {
          previous.status = 'superseded';
          await previous.save({ session });
        }
        const revision = (previous?.revision ?? 0) + 1;
        await this.sharings.create(
          [
            {
              familyLinkId: link._id,
              patientId: link.patientId,
              familyUserId: link.familyUserId,
              invitationVersion: link.invitationVersion,
              revision,
              status: 'active',
              scope: input.scope.scope,
              metricTypes:
                input.scope.scope === 'selected' ? input.scope.metricTypes : [],
              consentVersion: input.consentVersion,
              consentedBy: link.patientId,
              consentedAt: input.now,
            },
          ],
          { session },
        );
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'FamilyLink',
              entityId: link._id,
              actorId: link.patientId,
              userId: link.patientId,
              action: 'family_health_metric_sharing_granted',
              metadata: {
                invitationVersion: link.invitationVersion,
                revision,
                scope: input.scope.scope,
              },
            },
          ],
          { session },
        );
        await this.outbox.enqueue(
          {
            eventType: 'family.health-metric-sharing.changed.v1',
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: operationKey,
            payload: {
              familyLinkId: String(link._id),
              familyUserId: String(link.familyUserId),
              invitationVersion: link.invitationVersion,
              revision,
              fingerprint,
            },
          },
          session,
        );
        return { revision };
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const replay = await this.events
        .findOne({ idempotencyKey: operationKey })
        .lean()
        .exec();
      if (!replay)
        throw new ConflictException('FAMILY_SHARING_CONCURRENT_CHANGE');
      if (replay.payload?.fingerprint !== fingerprint)
        throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
      return { revision: Number(replay.payload.revision) };
    }
  }

  async revoke(
    input: Parameters<FamilyHealthMetricSharingRepository['revoke']>[0],
  ) {
    const operationKey = this.operationKey(
      input.patientId,
      input.idempotencyKey,
    );
    const fingerprint = this.hash(
      JSON.stringify({ action: 'revoke', link: input.familyLinkId }),
    );
    try {
      await this.connection.transaction(async (session) => {
        const replay = await this.events
          .findOne({ idempotencyKey: operationKey })
          .session(session)
          .lean()
          .exec();
        if (replay) {
          if (replay.payload?.fingerprint !== fingerprint)
            throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
          return;
        }
        const link = await this.links
          .findOneAndUpdate(
            {
              _id: new Types.ObjectId(input.familyLinkId),
              patientId: new Types.ObjectId(input.patientId),
              status: { $in: ['active', 'paused'] },
            },
          { $set: { updatedAt: input.now }, $inc: { __v: 1 } },
            { session, returnDocument: 'after', timestamps: false },
          )
          .exec();
        if (!link) throw new NotFoundException('FAMILY_LINK_NOT_FOUND');
        await this.sharings.updateMany(
          {
            familyLinkId: link._id,
            invitationVersion: link.invitationVersion,
            status: 'active',
          },
          {
            $set: {
              status: 'revoked',
              revokedAt: input.now,
              revokedBy: link.patientId,
            },
          },
          { session },
        );
        await this.audits.create(
          [
            {
              domain: 'care',
              entityType: 'FamilyLink',
              entityId: link._id,
              actorId: link.patientId,
              userId: link.patientId,
              action: 'family_health_metric_sharing_revoked',
              metadata: { invitationVersion: link.invitationVersion },
            },
          ],
          { session },
        );
        await this.outbox.enqueue(
          {
            eventType: 'family.health-metric-sharing.revoked.v1',
            aggregateType: 'FamilyLink',
            aggregateId: link._id,
            idempotencyKey: operationKey,
            payload: {
              familyLinkId: String(link._id),
              invitationVersion: link.invitationVersion,
              fingerprint,
            },
          },
          session,
        );
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const replay = await this.events
        .findOne({ idempotencyKey: operationKey })
        .lean()
        .exec();
      if (!replay)
        throw new ConflictException('FAMILY_SHARING_CONCURRENT_CHANGE');
      if (replay.payload?.fingerprint !== fingerprint)
        throw new ConflictException('IDEMPOTENCY_KEY_CONFLICT');
    }
  }

  private operationKey(actor: string, key: string) {
    return `family.health-sharing.${this.hash(`${actor}:${key}`)}`;
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
