import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createNodeRedisClient, Queue, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { OutboxService } from './outbox.service';
import { NotificationsService } from '../../modules/notifications/application/services/notifications.service';
import { renderCareAlertNotification } from './care-alert-notification.template';
import { CareTaskSchedulerService } from '../../modules/chronic-care/application/services/care-task-scheduler.service';
import { CareTaskReminderService } from '../../modules/chronic-care/application/services/care-task-reminder.service';
import { NotificationType } from '../../modules/notifications/domain/entities/notification.entity';
import { CareMetricEvaluationService } from '../../modules/chronic-care/application/services/care-metric-evaluation.service';
import { ConsultationStaleRecoveryService } from '../../modules/consultations/application/services/consultations/consultation-stale-recovery.service';
import { SubscriptionPaymentGrantService } from '../../modules/billing/application/services/subscription-payment-grant.service';

const OUTBOX_QUEUE = 'healthcare-outbox';
const DISPATCH_JOB = 'dispatch-pending-events';
const CARE_TASK_SCHEDULE_JOB = 'schedule-care-tasks';
const CONSULTATION_STALE_RECOVERY_JOB = 'recover-stale-consultations';
const PAYMENT_RECONCILIATION_JOB = 'reconcile-payment-grants';
const OUTBOX_OBSERVATION_INTERVAL_MS = 60_000;
const OUTBOX_PENDING_LAG_WARNING_MS = 5 * 60_000;
export const NOTIFICATION_REALTIME_CHANNEL = 'healthcare:notification-events';

@Injectable()
export class OutboxWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxWorkerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private lastObservedAt = 0;
  private readonly careAutomationEnabled: boolean;
  private readonly consultationRecoveryEnabled: boolean;
  private readonly paymentReconciliationEnabled: boolean;
  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    private readonly careTasks: CareTaskSchedulerService,
    private readonly reminders: CareTaskReminderService,
    private readonly careMetrics: CareMetricEvaluationService,
    private readonly staleConsultations: ConsultationStaleRecoveryService,
    private readonly subscriptionGrants: SubscriptionPaymentGrantService,
  ) {
    this.careAutomationEnabled =
      this.config.get<boolean>('CARE_MONITORING_AUTOMATION_ENABLED') === true;
    this.consultationRecoveryEnabled =
      this.config.get<boolean>('CONSULTATION_STALE_RECOVERY_ENABLED') === true;
    this.paymentReconciliationEnabled =
      this.config.get<boolean>('PAYMENT_RECONCILIATION_ENABLED') === true;
  }

  async onModuleInit() {
    const connection = createNodeRedisClient(this.redis.client as never);
    const prefix = this.config.get<string>('OUTBOX_QUEUE_PREFIX') ?? 'bull';
    this.queue = new Queue(OUTBOX_QUEUE, { connection, prefix });
    this.worker = new Worker(
      OUTBOX_QUEUE,
      async (job) =>
        job.name === DISPATCH_JOB
          ? this.dispatchOnce()
          : job.name === CARE_TASK_SCHEDULE_JOB
            ? this.careAutomationEnabled
              ? this.careTasks.scheduleActiveEnrollments()
              : undefined
            : job.name === CONSULTATION_STALE_RECOVERY_JOB
              ? this.consultationRecoveryEnabled
                ? this.staleConsultations.recover()
                : undefined
              : job.name === PAYMENT_RECONCILIATION_JOB
                ? this.paymentReconciliationEnabled
                  ? this.subscriptionGrants.reconcilePaidWithoutGrant()
                  : undefined
              : this.deliverEvent(
                  String(job.data.eventId),
                  job.attemptsMade,
                  job.opts.attempts ?? 1,
                ),
      { connection, prefix, concurrency: 4 },
    );
    await this.queue.upsertJobScheduler(
      'outbox-dispatch-schedule',
      { every: 5_000 },
      {
        name: DISPATCH_JOB,
        data: {},
        opts: { removeOnComplete: 100, removeOnFail: 100 },
      },
    );
    if (this.careAutomationEnabled) {
      await this.queue.upsertJobScheduler(
        'care-task-schedule',
        { every: 60_000 },
        {
          name: CARE_TASK_SCHEDULE_JOB,
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 100 },
        },
      );
    } else {
      await this.queue.removeJobScheduler('care-task-schedule');
    }
    if (this.consultationRecoveryEnabled) {
      await this.queue.upsertJobScheduler(
        'consultation-stale-recovery',
        { every: 60_000 },
        {
          name: CONSULTATION_STALE_RECOVERY_JOB,
          data: {},
          opts: { removeOnComplete: 100, removeOnFail: 100 },
        },
      );
    } else {
      await this.queue.removeJobScheduler('consultation-stale-recovery');
    }
    if (this.paymentReconciliationEnabled) {
      await this.queue.upsertJobScheduler(
        'payment-grant-reconciliation',
        { every: 60_000 },
        { name: PAYMENT_RECONCILIATION_JOB, data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
      );
    } else {
      await this.queue.removeJobScheduler('payment-grant-reconciliation');
    }
  }

  private async dispatchOnce() {
    const events = await this.outbox.claimBatch(
      50,
      30_000,
      this.careAutomationEnabled
        ? []
        : ['health.metric.recorded', 'care.task.reminder'],
    );
    for (const event of events) {
      await this.queue!.add(
        'deliver-event',
        { eventId: String(event._id) },
        {
          jobId: event.idempotencyKey.replace(/:/g, '.'),
          attempts: event.maxAttempts,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }
    await this.observeOutbox();
  }

  /**
   * Emits bounded, structured operational signals without exposing outbox
   * payloads. Deployment log collection alerts on dead events or sustained lag.
   */
  private async observeOutbox() {
    if (Date.now() - this.lastObservedAt < OUTBOX_OBSERVATION_INTERVAL_MS)
      return;
    this.lastObservedAt = Date.now();
    const metrics = await this.outbox.getMetrics();
    const counts = Object.fromEntries(
      metrics.byStatus.map((entry) => [entry._id, entry.count]),
    );
    const fields = {
      event: 'outbox.health',
      pending: counts.pending ?? 0,
      processing: counts.processing ?? 0,
      delivered: counts.delivered ?? 0,
      dead: counts.dead ?? 0,
      oldestPendingAgeMs: metrics.oldestPendingAgeMs,
    };
    if (fields.dead > 0) {
      this.logger.error(fields);
      return;
    }
    if (fields.oldestPendingAgeMs >= OUTBOX_PENDING_LAG_WARNING_MS) {
      this.logger.warn(fields);
      return;
    }
    this.logger.debug(fields);
  }

  private async deliverEvent(
    eventId: string,
    attemptsMade: number,
    attempts: number,
  ) {
    const event = await this.outbox.getProcessing(eventId);
    if (!event) return;
    if (
      !this.careAutomationEnabled &&
      ['health.metric.recorded', 'care.task.reminder'].includes(event.eventType)
    ) {
      await this.outbox.deferUntil(event._id, new Date(Date.now() + 60_000));
      return;
    }
    try {
      if (event.eventType === 'subscription.grant.requested') {
        const payload = event.payload as { orderId?: string };
        if (!payload.orderId) throw new Error('Invalid subscription grant payload');
        await this.subscriptionGrants.grantForPaidOrder(payload.orderId);
        await this.outbox.markDelivered(event._id);
        return;
      }
      if (event.eventType === 'health.metric.recorded') {
        const payload = event.payload as { metricId?: string };
        if (!payload.metricId) throw new Error('Invalid care metric event');
        await this.careMetrics.evaluateRecordedMetric(payload.metricId);
        await this.outbox.markDelivered(event._id);
        return;
      }
      if (event.eventType === 'care.task.reminder') {
        const payload = event.payload as {
          taskId?: string;
          patientId?: string;
          scheduledFor?: string;
        };
        if (!payload.taskId || !payload.patientId || !payload.scheduledFor)
          throw new Error('Invalid care task reminder payload');
        const scheduledFor = new Date(payload.scheduledFor);
        if (Number.isNaN(scheduledFor.getTime()))
          throw new Error('Invalid care task reminder time');
        if (scheduledFor > new Date()) {
          await this.outbox.deferUntil(event._id, scheduledFor);
          return;
        }
        if (
          await this.reminders.shouldNotify(payload.taskId, payload.patientId)
        ) {
          await this.notifications.create(payload.patientId, {
            userId: payload.patientId,
            type: NotificationType.INFO,
            title: 'Nhắc nhiệm vụ theo dõi',
            message:
              'Bạn có nhiệm vụ theo dõi sức khỏe cần thực hiện. Hãy xem chi tiết trong ứng dụng.',
            idempotencyKey: `care.task.reminder.${payload.taskId}`,
          });
        }
        await this.outbox.markDelivered(event._id);
        return;
      }
      if (
        event.eventType === 'care.alert.opened' ||
        event.eventType === 'care.alert.escalated'
      ) {
        const payload = event.payload as {
          alertId?: string;
          patientId?: string;
          severity?: 'attention' | 'urgent';
          evaluationId?: string;
        };
        if (
          !payload.alertId ||
          !payload.patientId ||
          !payload.severity ||
          (event.eventType === 'care.alert.escalated' && !payload.evaluationId)
        )
          throw new Error('Invalid care alert payload');
        const template = renderCareAlertNotification({
          severity: payload.severity,
        });
        await this.notifications.create(payload.patientId, {
          userId: payload.patientId,
          ...template,
          idempotencyKey:
            event.eventType === 'care.alert.escalated'
              ? `care.alert.notification.${payload.alertId}.${payload.evaluationId}`
              : `care.alert.notification.${payload.alertId}`,
        });
        await this.outbox.markDelivered(event._id);
        return;
      }
      if (
        [
          'consultation.on-demand-timeout-warning',
          'consultation.on-demand-timeout-extended',
          'consultation.on-demand-timeout-cancelled',
          'consultation.scheduled-stale-review',
        ].includes(event.eventType)
      ) {
        const payload = event.payload as {
          consultationId?: string;
          patientId?: string;
          doctorId?: string;
        };
        if (!payload.consultationId || !payload.patientId || !payload.doctorId)
          throw new Error('Invalid consultation recovery payload');
        const message =
          event.eventType === 'consultation.on-demand-timeout-warning'
            ? {
                type: NotificationType.WARNING,
                title: 'Lịch tư vấn sắp tự hủy',
                message:
                  'Lịch tư vấn đang chờ sẽ tự hủy nếu không bắt đầu kịp thời.',
              }
            : event.eventType === 'consultation.on-demand-timeout-extended'
              ? {
                  type: NotificationType.WARNING,
                  title: 'Lịch tư vấn được gia hạn chờ',
                  message:
                    'Hệ thống ghi nhận kết nối phòng chờ và gia hạn một lần.',
                }
              : event.eventType === 'consultation.on-demand-timeout-cancelled'
                ? {
                    type: NotificationType.INFO,
                    title: 'Lịch tư vấn đã tự hủy',
                    message:
                      'Lịch tư vấn chưa bắt đầu đã được hệ thống tự hủy; lượt giữ đã được hoàn lại nếu có.',
                  }
                : {
                    type: NotificationType.WARNING,
                    title: 'Cần rà soát lịch tư vấn',
                    message:
                      'Lịch hẹn đã quá 24 giờ nhưng chưa kết thúc. Vui lòng rà soát.',
                  };
        const recipients =
          event.eventType === 'consultation.scheduled-stale-review'
            ? [payload.doctorId]
            : [payload.patientId, payload.doctorId];
        for (const userId of recipients)
          await this.notifications.create(userId, {
            userId,
            ...message,
            idempotencyKey: `${event.eventType}.${payload.consultationId}.${userId}`,
          });
        await this.outbox.markDelivered(event._id);
        return;
      }
      if (
        ![
          'notification.created',
          'notification.realtime',
          'care.alert.opened',
          'care.alert.inbox-invalidated',
          'care.alert.consultation-linked',
        ].includes(event.eventType)
      )
        throw new Error(`Unsupported outbox event: ${event.eventType}`);
      await this.redis.run(
        this.redis.client.publish(
          NOTIFICATION_REALTIME_CHANNEL,
          JSON.stringify({ eventId: String(event._id), ...event.payload }),
        ),
      );
      await this.outbox.markDelivered(event._id);
    } catch (error) {
      await this.outbox.recordAttemptFailure(
        event._id,
        error,
        attemptsMade + 1 >= attempts,
      );
      throw error;
    }
  }

  async onApplicationShutdown() {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }
}
