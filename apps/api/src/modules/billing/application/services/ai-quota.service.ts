import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, HydratedDocument, Model, Types } from 'mongoose';
import { FreeSubscriptionGrantService } from './free-subscription-grant.service';
import { AiQuotaPort, AiQuotaReservationResult } from '../ports/ai-quota.port';
import {
  AiQuotaReservation,
  AiQuotaReservationDocument,
  AiQuotaReservationStatus,
  AiUsageDaily,
  AiUsageDailyDocument,
} from '../../domain/entities/ai-usage.entity';
import { AuditLog } from '../../../platform-audit/public-api';

@Injectable()
export class AiQuotaService implements AiQuotaPort {
  constructor(
    @InjectModel(AiUsageDaily.name)
    private readonly usage: Model<AiUsageDailyDocument>,
    @InjectModel(AiQuotaReservation.name)
    private readonly reservations: Model<AiQuotaReservationDocument>,
    @InjectModel(AuditLog.name)
    private readonly audits: Model<HydratedDocument<AuditLog>>,
    @InjectConnection() private readonly connection: Connection,
    private readonly subscriptions: FreeSubscriptionGrantService,
  ) {}

  async reserve(input: {
    userId: string;
    idempotencyKey: string;
    estimatedInputTokens: number;
    maxOutputTokens: number;
  }): Promise<AiQuotaReservationResult> {
    if (
      !Types.ObjectId.isValid(input.userId) ||
      !input.idempotencyKey ||
      input.estimatedInputTokens < 0 ||
      input.maxOutputTokens < 1
    )
      throw new HttpException(
        'Invalid AI quota request',
        HttpStatus.BAD_REQUEST,
      );
    const existing = await this.reservations
      .findOne({
        userId: new Types.ObjectId(input.userId),
        idempotencyKey: input.idempotencyKey,
      })
      .lean();
    if (existing)
      return {
        reservationId: String(existing._id),
        estimatedInputTokens: existing.estimatedInputTokens,
        maxOutputTokens: existing.maxOutputTokens,
        status: existing.status,
      };
    const subscription = await this.subscriptions.getEffectiveSubscription(
      input.userId,
    );
    if (!subscription)
      throw new HttpException(
        'AI quota is unavailable',
        HttpStatus.PAYMENT_REQUIRED,
      );
    const snapshot = subscription.planSnapshot;
    const periodType = snapshot.aiQuotaPeriod;
    const periodStart =
      periodType === 'day'
        ? this.dayStart(new Date())
        : subscription.currentPeriodStart;
    const reservedTokens = input.estimatedInputTokens + input.maxOutputTokens;
    return this.connection.transaction(async (session) => {
      const duplicate = await this.reservations
        .findOne({
          userId: new Types.ObjectId(input.userId),
          idempotencyKey: input.idempotencyKey,
        })
        .session(session)
        .lean();
      if (duplicate)
        return {
          reservationId: String(duplicate._id),
          estimatedInputTokens: duplicate.estimatedInputTokens,
          maxOutputTokens: duplicate.maxOutputTokens,
          status: duplicate.status,
        };
      await this.usage.updateOne(
        { userId: new Types.ObjectId(input.userId), periodType, periodStart },
        {
          $setOnInsert: {
            userId: new Types.ObjectId(input.userId),
            periodType,
            periodStart,
            chatRequestCount: 0,
            chatInputTokens: 0,
            chatOutputTokens: 0,
            chatTotalTokens: 0,
            reservedRequestCount: 0,
            reservedTokens: 0,
          },
        },
        { upsert: true, session },
      );
      const claimed = await this.usage
        .findOneAndUpdate(
          {
            userId: new Types.ObjectId(input.userId),
            periodType,
            periodStart,
            $expr: {
              $and: [
                {
                  $lte: [
                    { $add: ['$chatRequestCount', '$reservedRequestCount', 1] },
                    snapshot.aiRequestLimit,
                  ],
                },
                {
                  $lte: [
                    {
                      $add: [
                        '$chatTotalTokens',
                        '$reservedTokens',
                        reservedTokens,
                      ],
                    },
                    snapshot.aiTokenLimit,
                  ],
                },
              ],
            },
          },
          { $inc: { reservedRequestCount: 1, reservedTokens } },
          { new: true, session },
        )
        .exec();
      if (!claimed)
        throw new HttpException(
          'AI quota exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const record = await this.reservations.create(
        [
          {
            userId: new Types.ObjectId(input.userId),
            subscriptionId: subscription._id,
            periodType,
            periodStart,
            idempotencyKey: input.idempotencyKey,
            status: AiQuotaReservationStatus.RESERVED,
            reservedTokens,
            estimatedInputTokens: input.estimatedInputTokens,
            maxOutputTokens: input.maxOutputTokens,
          },
        ],
        { session },
      );
      return {
        reservationId: String(record[0]._id),
        estimatedInputTokens: input.estimatedInputTokens,
        maxOutputTokens: input.maxOutputTokens,
        status: AiQuotaReservationStatus.RESERVED,
      };
    });
  }

  async commit(input: {
    reservationId: string;
    inputTokens: number;
    outputTokens: number;
  }) {
    await this.finish(
      input.reservationId,
      Math.max(0, input.inputTokens) + Math.max(0, input.outputTokens),
      input,
    );
  }
  async release(reservationId: string) {
    await this.finish(reservationId, 0);
  }
  async markUsageReconciliationRequired(
    reservationId: string,
    reason: string,
  ) {
    if (!Types.ObjectId.isValid(reservationId)) return;
    await this.connection.transaction(async (session) => {
      const record = await this.reservations
        .findById(reservationId)
        .session(session);
      if (!record || record.status !== AiQuotaReservationStatus.RESERVED) return;
      record.status = AiQuotaReservationStatus.USAGE_RECONCILIATION_REQUIRED;
      record.usageReconciliationRequiredAt = new Date();
      record.settlementFailureReason = reason.slice(0, 256);
      await record.save({ session });
      await this.audits.create(
        [
          {
            domain: 'billing',
            entityType: 'AiQuotaReservation',
            entityId: record._id,
            userId: record.userId,
            action: 'ai_quota_usage_reconciliation_required',
            reason: record.settlementFailureReason,
            metadata: {
              periodType: record.periodType,
              periodStart: record.periodStart,
              reservedTokens: record.reservedTokens,
            },
          },
        ],
        { session },
      );
    });
  }
  private async finish(
    reservationId: string,
    chargedTokens: number,
    actual?: { inputTokens: number; outputTokens: number },
  ) {
    if (!Types.ObjectId.isValid(reservationId)) return;
    await this.connection.transaction(async (session) => {
      const record = await this.reservations
        .findById(reservationId)
        .session(session);
      if (!record || record.status !== AiQuotaReservationStatus.RESERVED)
        return;
      // The reservation is an admission envelope, not an accounting cap. The
      // provider-reported usage remains the source of truth even if it exceeds
      // that envelope; later requests are then rejected against the true total.
      const effectiveCharge = chargedTokens;
      await this.usage.updateOne(
        {
          userId: record.userId,
          periodType: record.periodType,
          periodStart: record.periodStart,
        },
        {
          $inc: {
            reservedRequestCount: -1,
            reservedTokens: -record.reservedTokens,
            chatRequestCount: actual ? 1 : 0,
            chatInputTokens: actual?.inputTokens ?? 0,
            chatOutputTokens: actual?.outputTokens ?? 0,
            chatTotalTokens: effectiveCharge,
          },
        },
        { session },
      );
      record.status = actual
        ? AiQuotaReservationStatus.COMMITTED
        : AiQuotaReservationStatus.RELEASED;
      record.committedInputTokens = actual?.inputTokens;
      record.committedOutputTokens = actual?.outputTokens;
      if (!actual) record.releasedAt = new Date();
      await record.save({ session });
    });
  }
  private dayStart(date: Date) {
    const value = new Date(date);
    value.setUTCHours(0, 0, 0, 0);
    return value;
  }
}
