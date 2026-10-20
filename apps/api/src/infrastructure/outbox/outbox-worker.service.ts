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

const OUTBOX_QUEUE = 'healthcare-outbox';
const DISPATCH_JOB = 'dispatch-pending-events';
const CARE_TASK_SCHEDULE_JOB = 'schedule-care-tasks';
export const NOTIFICATION_REALTIME_CHANNEL = 'healthcare:notification-events';

@Injectable()
export class OutboxWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxWorkerService.name);
  private queue?: Queue;
  private worker?: Worker;
  private readonly careAutomationEnabled: boolean;
  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    private readonly careTasks: CareTaskSchedulerService,
    private readonly reminders: CareTaskReminderService,
    private readonly careMetrics: CareMetricEvaluationService,
  ) {
    this.careAutomationEnabled =
      this.config.get<boolean>('CARE_MONITORING_AUTOMATION_ENABLED') === true;
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
