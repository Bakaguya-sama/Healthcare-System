import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { RedisService } from '../../../../../infrastructure/redis/redis.service';
import { RedisKeyService } from '../../../../../infrastructure/redis/redis-key.service';
import { OutboxService } from '../../../../../infrastructure/outbox/outbox.service';
import { AuditLog as AuditLogEntity } from '../../../../platform-audit/public-api';
import type { AuditLog } from '../../../../platform-audit/public-api';
import { CONSULTATION_USAGE_PORT } from '../../../../billing/application/ports/consultation-usage.port';
import type { ConsultationUsagePort } from '../../../../billing/application/ports/consultation-usage.port';
import {
  Consultation,
  ConsultationDocument,
  ConsultationMode,
  ConsultationQuotaPolicy,
  ConsultationRequestStatus,
  ConsultationSessionStatus,
} from '../../../domain/entities/consultations/consultation.entity';
import { Inject } from '@nestjs/common';

const WARNING_AFTER_MS = 45 * 60_000;
const CANCEL_AFTER_MS = 60 * 60_000;
const WARNING_GRACE_MS = 15 * 60_000;
const CONNECTION_EXTENSION_MS = 10 * 60_000;
const SCHEDULED_REVIEW_AFTER_MS = 24 * 60 * 60_000;

@Injectable()
export class ConsultationStaleRecoveryService {
  private readonly logger = new Logger(ConsultationStaleRecoveryService.name);
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultations: Model<ConsultationDocument>,
    @InjectModel(AuditLogEntity.name) private readonly audits: Model<AuditLog>,
    @InjectConnection() private readonly connection: Connection,
    private readonly redis: RedisService,
    private readonly keys: RedisKeyService,
    private readonly outbox: OutboxService,
    @Inject(CONSULTATION_USAGE_PORT)
    private readonly usage: ConsultationUsagePort,
  ) {}

  async recover(now = new Date(), limit = 100) {
    const candidates = await this.consultations
      .find({
        requestStatus: ConsultationRequestStatus.ACCEPTED,
        sessionStatus: ConsultationSessionStatus.WAITING,
        $or: [
          {
            mode: ConsultationMode.ON_DEMAND,
            respondedAt: { $lte: new Date(now.getTime() - WARNING_AFTER_MS) },
            $or: [
              { onDemandTimeoutWarningQueuedAt: { $exists: false } },
              { onDemandTimeoutWarningQueuedAt: { $ne: null } },
            ],
          },
          {
            mode: ConsultationMode.SCHEDULED,
            scheduledStartAt: {
              $lte: new Date(now.getTime() - SCHEDULED_REVIEW_AFTER_MS),
            },
            scheduledStaleReviewQueuedAt: { $exists: false },
          },
        ],
      })
      .sort({ respondedAt: 1, scheduledStartAt: 1, _id: 1 })
      .limit(Math.max(1, Math.min(200, limit)))
      .exec();
    for (const consultation of candidates) {
      try {
        if (consultation.mode === ConsultationMode.ON_DEMAND)
          await this.recoverOnDemand(consultation, now);
        else await this.queueScheduledReview(consultation, now);
      } catch (error) {
        // Presence failures must leave the consultation untouched; the next job retries.
        this.logger.warn({
          event: 'consultation.stale-recovery.deferred',
          consultationId: String(consultation._id),
          error: String(error),
        });
      }
    }
  }

  private async recoverOnDemand(c: ConsultationDocument, now: Date) {
    if (!c.respondedAt) return;
    const elapsed = now.getTime() - c.respondedAt.getTime();
    if (elapsed >= WARNING_AFTER_MS && !c.onDemandTimeoutWarningQueuedAt) {
      await this.connection.transaction(async (session) => {
        const current = await this.consultations
          .findById(c._id)
          .session(session);
        if (
          !current ||
          current.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
          current.sessionStatus !== ConsultationSessionStatus.WAITING ||
          current.onDemandTimeoutWarningQueuedAt
        )
          return;
        current.onDemandTimeoutWarningQueuedAt = now;
        await current.save({ session });
        await this.outbox.enqueue(
          {
            eventType: 'consultation.on-demand-timeout-warning',
            aggregateType: 'Consultation',
            aggregateId: current._id,
            payload: this.payload(current),
            idempotencyKey: `consultation.timeout-warning:${current._id}`,
          },
          session,
        );
        await this.audit(current, 'on_demand_timeout_warning_queued', session);
      });
      return;
    }
    if (elapsed < CANCEL_AFTER_MS || !c.onDemandTimeoutWarningQueuedAt) return;
    const eligibleAt = Math.max(
      c.respondedAt.getTime() + CANCEL_AFTER_MS,
      c.onDemandTimeoutWarningQueuedAt.getTime() + WARNING_GRACE_MS,
    );
    if (now.getTime() < eligibleAt) return;
    if (c.onDemandTimeoutExtensionExpiresAt) {
      if (now < c.onDemandTimeoutExtensionExpiresAt) return;
      await this.cancel(c, now);
      return;
    }
    if (await this.hasWaitingRoomPresence(c)) {
      await this.connection.transaction(async (session) => {
        const current = await this.consultations
          .findById(c._id)
          .session(session);
        if (
          !current ||
          current.onDemandTimeoutExtensionExpiresAt ||
          current.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
          current.sessionStatus !== ConsultationSessionStatus.WAITING
        )
          return;
        current.onDemandTimeoutExtensionExpiresAt = new Date(
          now.getTime() + CONNECTION_EXTENSION_MS,
        );
        await current.save({ session });
        await this.outbox.enqueue(
          {
            eventType: 'consultation.on-demand-timeout-extended',
            aggregateType: 'Consultation',
            aggregateId: current._id,
            payload: this.payload(current),
            idempotencyKey: `consultation.timeout-extension:${current._id}`,
          },
          session,
        );
        await this.audit(current, 'on_demand_timeout_extended', session);
      });
      return;
    }
    await this.cancel(c, now);
  }

  private async cancel(c: ConsultationDocument, now: Date) {
    await this.connection.transaction(async (session) => {
      const current = await this.consultations.findById(c._id).session(session);
      if (
        !current ||
        current.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
        current.sessionStatus !== ConsultationSessionStatus.WAITING
      )
        return;
      current.requestStatus = ConsultationRequestStatus.CANCELLED;
      current.sessionStatus = ConsultationSessionStatus.NOT_STARTED;
      current.cancelledAt = now;
      current.cancellationReason = 'system_timeout';
      await current.save({ session });
      if (
        current.quotaPolicy !== ConsultationQuotaPolicy.CARE_PROGRAM_INCLUDED &&
        !current.legacyQuotaExempt
      )
        await this.usage.release({
          consultationId: String(current._id),
          reason: 'cancelled',
          session,
        });
      await this.outbox.enqueue(
        {
          eventType: 'consultation.on-demand-timeout-cancelled',
          aggregateType: 'Consultation',
          aggregateId: current._id,
          payload: this.payload(current),
          idempotencyKey: `consultation.timeout-cancelled:${current._id}`,
        },
        session,
      );
      await this.audit(
        current,
        'on_demand_timeout_cancelled',
        session,
        'system_timeout',
      );
    });
  }

  private async queueScheduledReview(c: ConsultationDocument, now: Date) {
    if (
      !c.scheduledStartAt ||
      c.scheduledStaleReviewQueuedAt ||
      now.getTime() - c.scheduledStartAt.getTime() < SCHEDULED_REVIEW_AFTER_MS
    )
      return;
    await this.connection.transaction(async (session) => {
      const current = await this.consultations.findById(c._id).session(session);
      if (
        !current ||
        current.scheduledStaleReviewQueuedAt ||
        current.requestStatus !== ConsultationRequestStatus.ACCEPTED ||
        current.sessionStatus !== ConsultationSessionStatus.WAITING
      )
        return;
      current.scheduledStaleReviewQueuedAt = now;
      await current.save({ session });
      await this.outbox.enqueue(
        {
          eventType: 'consultation.scheduled-stale-review',
          aggregateType: 'Consultation',
          aggregateId: current._id,
          payload: this.payload(current),
          idempotencyKey: `consultation.scheduled-stale-review:${current._id}`,
        },
        session,
      );
      await this.audit(current, 'scheduled_stale_review_queued', session);
    });
  }

  private async hasWaitingRoomPresence(c: ConsultationDocument) {
    const keys = [String(c.patientId), String(c.doctorId)].map((id) =>
      this.keys.build('consultation', 'waiting-room', String(c._id), id),
    );
    const values = await Promise.all(
      keys.map((key) => this.redis.run(this.redis.client.get(key))),
    );
    return values.some(Boolean);
  }
  private payload(c: ConsultationDocument) {
    return {
      consultationId: String(c._id),
      patientId: String(c.patientId),
      doctorId: String(c.doctorId),
    };
  }
  private async audit(
    c: ConsultationDocument,
    action: string,
    session: import('mongoose').ClientSession,
    reason?: string,
  ) {
    await this.audits.create(
      [
        {
          domain: 'consultation',
          entityType: 'Consultation',
          entityId: c._id,
          action,
          userId: c.patientId,
          reason,
          metadata: { automated: true },
        },
      ],
      { session },
    );
  }
}
