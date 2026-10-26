import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, type ClientSession } from 'mongoose';
import { AuditLog } from '../../../platform-audit/public-api';
import type { ConsultationUsagePort } from '../ports/consultation-usage.port';
import {
  ConsultationUsage,
  ConsultationUsageDocument,
  ConsultationUsageStatus,
} from '../../domain/entities/consultation-usage.entity';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
} from '../../domain/entities/subscription.entity';
import { FreeSubscriptionGrantService } from './free-subscription-grant.service';

@Injectable()
export class ConsultationUsageService implements ConsultationUsagePort {
  constructor(
    @InjectModel(ConsultationUsage.name)
    private readonly usages: Model<ConsultationUsageDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<SubscriptionDocument>,
    @InjectModel(AuditLog.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    private readonly grants: FreeSubscriptionGrantService,
  ) {}

  async prepare(patientId: string): Promise<void> {
    this.assertObjectId(patientId, 'patient');
    await this.grants.getEffectiveSubscription(patientId);
  }

  async listReserved(after?: string, limit = 100) {
    if (after) this.assertObjectId(after, 'usage');
    const rows = await this.usages
      .find({
        status: ConsultationUsageStatus.RESERVED,
        ...(after ? { _id: { $gt: new Types.ObjectId(after) } } : {}),
      })
      .select('_id consultationId')
      .sort({ _id: 1 })
      .limit(Math.max(1, Math.min(1000, Math.floor(limit))))
      .lean()
      .exec();
    return rows.map((row) => ({
      consultationId: String(row.consultationId),
      cursor: String(row._id),
    }));
  }

  async reserve(input: {
    consultationId: string;
    patientId: string;
    session?: ClientSession;
  }) {
    this.assertObjectId(input.consultationId, 'consultation');
    this.assertObjectId(input.patientId, 'patient');
    // Provision a Free grant before opening the ledger transaction. The ledger
    // transaction then only reads the effective immutable snapshot.
    if (!input.session) await this.prepare(input.patientId);
    const execute = async (session: ClientSession) => {
      const consultationId = new Types.ObjectId(input.consultationId);
      const existing = await this.usages
        .findOne({ consultationId })
        .session(session)
        .lean()
        .exec();
      if (existing) return { status: existing.status, created: false };

      const now = new Date();
      const subscription = await this.subscriptions
        .findOne({
          userId: new Types.ObjectId(input.patientId),
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: { $lte: now },
          currentPeriodEnd: { $gt: now },
          expiresAt: { $gt: now },
        })
        .session(session)
        .exec();
      const limit = subscription?.planSnapshot?.consultationLimitPerCycle;
      if (
        !subscription ||
        typeof limit !== 'number' ||
        !Number.isSafeInteger(limit) ||
        limit < 0
      )
        throw new HttpException(
          'Consultation quota is unavailable',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const consultationLimit = limit;

      const claimed = await this.subscriptions
        .findOneAndUpdate(
          {
            _id: subscription._id,
            status: SubscriptionStatus.ACTIVE,
            $expr: {
              $lt: [
                {
                  $add: [
                    { $ifNull: ['$consultationUsageReserved', 0] },
                    { $ifNull: ['$consultationUsageCounted', 0] },
                  ],
                },
                consultationLimit,
              ],
            },
          },
          { $inc: { consultationUsageReserved: 1 } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!claimed)
        throw new HttpException(
          'Consultation limit reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );

      const usage = new this.usages({
        userId: subscription.userId,
        subscriptionId: subscription._id,
        consultationId,
        cycleStart: subscription.currentPeriodStart,
        cycleEnd: subscription.currentPeriodEnd,
        limitAtTime: consultationLimit,
        status: ConsultationUsageStatus.RESERVED,
        source: 'plan',
        uniqueRequestKey: `consultation:${consultationId}`,
        reservedAt: now,
      });
      await usage.save({ session });
      await this.audit(
        usage,
        undefined,
        ConsultationUsageStatus.RESERVED,
        session,
      );
      return { status: ConsultationUsageStatus.RESERVED, created: true };
    };
    try {
      return await this.inTransaction(input.session, execute);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const existing = await this.usages
        .findOne({ consultationId: new Types.ObjectId(input.consultationId) })
        .lean()
        .exec();
      if (existing) return { status: existing.status, created: false };
      throw error;
    }
  }

  async count(input: { consultationId: string; session?: ClientSession }) {
    return this.transition(
      input.consultationId,
      ConsultationUsageStatus.COUNTED,
      input.session,
    );
  }

  async release(input: {
    consultationId: string;
    reason: 'cancelled' | 'declined';
    session?: ClientSession;
  }) {
    return this.transition(
      input.consultationId,
      ConsultationUsageStatus.RELEASED,
      input.session,
      input.reason,
    );
  }

  async reconcileCounters(limit = 100, after?: string) {
    if (after) this.assertObjectId(after, 'subscription');
    const rows = await this.subscriptions
      .find(after ? { _id: { $gt: new Types.ObjectId(after) } } : {})
      .select('_id')
      .sort({ _id: 1 })
      .limit(Math.max(1, Math.min(1000, Math.floor(limit))))
      .lean()
      .exec();
    let repaired = 0;
    for (const row of rows) {
      const changed = await this.inTransaction(undefined, async (session) => {
        const subscription = await this.subscriptions
          .findById(row._id)
          .session(session)
          .exec();
        if (!subscription) return false;
        const filter = {
          subscriptionId: subscription._id,
          cycleStart: subscription.currentPeriodStart,
        };
        const reserved = await this.usages
          .countDocuments({
            ...filter,
            status: ConsultationUsageStatus.RESERVED,
          })
          .session(session);
        const counted = await this.usages
          .countDocuments({
            ...filter,
            status: ConsultationUsageStatus.COUNTED,
          })
          .session(session);
        if (
          subscription.consultationUsageReserved === reserved &&
          subscription.consultationUsageCounted === counted
        )
          return false;
        const previous = {
          reserved: subscription.consultationUsageReserved,
          counted: subscription.consultationUsageCounted,
        };
        subscription.consultationUsageReserved = reserved;
        subscription.consultationUsageCounted = counted;
        await subscription.save({ session });
        await this.audits.create(
          [
            {
              domain: 'billing',
              entityType: 'subscription',
              entityId: subscription._id,
              userId: subscription.userId,
              action: 'consultation_usage_counters_reconciled',
              metadata: { previous, reserved, counted },
            },
          ],
          { session },
        );
        return true;
      });
      if (changed) repaired++;
    }
    return {
      scanned: rows.length,
      repaired,
      nextCursor: rows.length ? String(rows[rows.length - 1]._id) : null,
    };
  }

  private async transition(
    consultationId: string,
    target:
      | ConsultationUsageStatus.COUNTED
      | ConsultationUsageStatus.RELEASED
      | ConsultationUsageStatus.EXPIRED,
    suppliedSession?: ClientSession,
    reason?: string,
  ) {
    this.assertObjectId(consultationId, 'consultation');
    return this.inTransaction(suppliedSession, async (session) => {
      const usage = await this.usages
        .findOne({ consultationId: new Types.ObjectId(consultationId) })
        .session(session)
        .exec();
      if (!usage || usage.status !== ConsultationUsageStatus.RESERVED)
        return usage?.status ?? null;
      const now = new Date();
      usage.status = target;
      if (target === ConsultationUsageStatus.COUNTED) usage.countedAt = now;
      else {
        usage.releasedAt = now;
        usage.releaseReason = reason ?? 'reservation_expired';
      }
      await usage.save({ session });
      const subscription = await this.subscriptions
        .findById(usage.subscriptionId)
        .session(session)
        .exec();
      if (!subscription) throw new Error('Usage subscription not found');
      if (
        subscription.currentPeriodStart.getTime() === usage.cycleStart.getTime()
      ) {
        const updated = await this.subscriptions.updateOne(
          {
            _id: usage.subscriptionId,
            currentPeriodStart: usage.cycleStart,
            consultationUsageReserved: { $gte: 1 },
          },
          {
            $inc:
              target === ConsultationUsageStatus.COUNTED
                ? { consultationUsageReserved: -1, consultationUsageCounted: 1 }
                : { consultationUsageReserved: -1 },
          },
          { session },
        );
        if (updated.modifiedCount !== 1)
          throw new Error('Consultation quota counter is inconsistent');
      }
      await this.audit(
        usage,
        ConsultationUsageStatus.RESERVED,
        target,
        session,
        reason,
      );
      return target;
    });
  }

  private async audit(
    usage: ConsultationUsageDocument,
    fromStatus: ConsultationUsageStatus | undefined,
    toStatus: ConsultationUsageStatus,
    session: ClientSession,
    reason?: string,
  ) {
    await this.audits.create(
      [
        {
          domain: 'billing',
          entityType: 'consultationUsage',
          entityId: usage._id,
          userId: usage.userId,
          action: `consultation_usage_${toStatus}`,
          fromStatus,
          toStatus,
          reason,
          metadata: {
            consultationId: String(usage.consultationId),
            subscriptionId: String(usage.subscriptionId),
          },
        },
      ],
      { session },
    );
  }

  private async inTransaction<T>(
    suppliedSession: ClientSession | undefined,
    execute: (session: ClientSession) => Promise<T>,
  ) {
    if (suppliedSession) return execute(suppliedSession);
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await execute(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private assertObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) throw new Error(`Invalid ${label} ID`);
  }
}
