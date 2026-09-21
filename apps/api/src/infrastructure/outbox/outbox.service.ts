import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import {
  OutboxEvent,
  OutboxEventDocument,
  OutboxStatus,
} from './entities/outbox-event.entity';

@Injectable()
export class OutboxService {
  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly model: Model<OutboxEventDocument>,
  ) {}

  async enqueue(
    input: {
      eventType: string;
      aggregateType: string;
      aggregateId: Types.ObjectId;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    },
    session?: ClientSession,
  ) {
    const query = this.model.findOneAndUpdate(
      { idempotencyKey: input.idempotencyKey },
      {
        $setOnInsert: {
          ...input,
          status: OutboxStatus.PENDING,
          nextAttemptAt: new Date(),
          attemptCount: 0,
          maxAttempts: 8,
        },
      },
      { upsert: true, new: true },
    );
    if (session) query.session(session);
    return query.exec();
  }

  async getProcessing(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model
      .findOne({ _id: new Types.ObjectId(id), status: OutboxStatus.PROCESSING })
      .exec();
  }

  async claimBatch(limit = 50, leaseMs = 30_000) {
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const now = new Date();
    const claimed: OutboxEventDocument[] = [];
    for (let index = 0; index < boundedLimit; index += 1) {
      const event = await this.model
        .findOneAndUpdate(
          {
            $or: [
              { status: OutboxStatus.PENDING, nextAttemptAt: { $lte: now } },
              { status: OutboxStatus.PROCESSING, lockExpiresAt: { $lte: now } },
            ],
          },
          {
            $set: {
              status: OutboxStatus.PROCESSING,
              lockedAt: now,
              lockExpiresAt: new Date(now.getTime() + leaseMs),
            },
          },
          { new: true, sort: { nextAttemptAt: 1, _id: 1 } },
        )
        .exec();
      if (!event) break;
      claimed.push(event);
    }
    return claimed;
  }

  async markDelivered(id: Types.ObjectId) {
    return this.model
      .updateOne(
        { _id: id, status: OutboxStatus.PROCESSING },
        {
          $set: { status: OutboxStatus.DELIVERED, deliveredAt: new Date() },
          $unset: { lockedAt: '', lockExpiresAt: '' },
        },
      )
      .exec();
  }
  async markFailed(id: Types.ObjectId, error: unknown) {
    const event = await this.model
      .findById(id)
      .select('attemptCount maxAttempts')
      .lean()
      .exec();
    if (!event) return;
    const attemptCount = event.attemptCount + 1;
    const dead = attemptCount >= event.maxAttempts;
    return this.model
      .updateOne(
        { _id: id, status: OutboxStatus.PROCESSING },
        {
          $set: {
            status: dead ? OutboxStatus.DEAD : OutboxStatus.PENDING,
            attemptCount,
            lastError: String(error).slice(0, 1000),
            nextAttemptAt: new Date(
              Date.now() + Math.min(1_000 * 2 ** attemptCount, 300_000),
            ),
          },
          $unset: { lockedAt: '', lockExpiresAt: '' },
        },
      )
      .exec();
  }

  async recordAttemptFailure(
    id: Types.ObjectId,
    error: unknown,
    finalAttempt: boolean,
  ) {
    return this.model
      .updateOne(
        { _id: id, status: OutboxStatus.PROCESSING },
        finalAttempt
          ? {
              $set: {
                status: OutboxStatus.DEAD,
                lastError: String(error).slice(0, 1000),
              },
              $inc: { attemptCount: 1 },
              $unset: { lockedAt: '', lockExpiresAt: '' },
            }
          : {
              $set: {
                lastError: String(error).slice(0, 1000),
                lockExpiresAt: new Date(Date.now() + 30_000),
              },
              $inc: { attemptCount: 1 },
            },
      )
      .exec();
  }

  async requeueDead(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), status: OutboxStatus.DEAD },
        {
          $set: { status: OutboxStatus.PENDING, nextAttemptAt: new Date() },
          $unset: {
            lockedAt: '',
            lockExpiresAt: '',
            deliveredAt: '',
            lastError: '',
          },
        },
        { new: true },
      )
      .exec();
  }

  async getMetrics() {
    const [result] = await this.model.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          oldestPending: [
            { $match: { status: OutboxStatus.PENDING } },
            { $sort: { nextAttemptAt: 1, _id: 1 } },
            { $limit: 1 },
            { $project: { _id: 1, nextAttemptAt: 1, createdAt: 1 } },
          ],
        },
      },
    ]);
    return {
      byStatus: result?.byStatus ?? [],
      oldestPending: result?.oldestPending?.[0] ?? null,
    };
  }
}
