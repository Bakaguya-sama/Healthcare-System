import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { OutboxService } from './outbox.service';
import { NotificationsService } from '../../modules/notifications/application/services/notifications.service';
import { renderCareAlertNotification } from './care-alert-notification.template';

const OUTBOX_QUEUE = 'healthcare-outbox';
const DISPATCH_JOB = 'dispatch-pending-events';
export const NOTIFICATION_REALTIME_CHANNEL = 'healthcare:notification-events';

@Injectable()
export class OutboxWorkerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxWorkerService.name);
  private queue?: Queue;
  private worker?: Worker;
  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const connection = {
      url: this.config.getOrThrow<string>('REDIS_URL'),
    } as any;
    this.queue = new Queue(OUTBOX_QUEUE, { connection });
    this.worker = new Worker(
      OUTBOX_QUEUE,
      async (job) =>
        job.name === DISPATCH_JOB
          ? this.dispatchOnce()
          : this.deliverEvent(
              String(job.data.eventId),
              job.attemptsMade,
              job.opts.attempts ?? 1,
            ),
      { connection, concurrency: 4 },
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
  }

  private async dispatchOnce() {
    const events = await this.outbox.claimBatch(50);
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
    try {
      if (event.eventType === 'care.alert.opened') {
        const payload = event.payload as {
          alertId?: string;
          patientId?: string;
          severity?: 'attention' | 'urgent';
        };
        if (!payload.alertId || !payload.patientId || !payload.severity)
          throw new Error('Invalid care alert payload');
        const template = renderCareAlertNotification({
          severity: payload.severity,
        });
        await this.notifications.create(payload.patientId, {
          userId: payload.patientId,
          ...template,
          idempotencyKey: `care.alert.notification.${payload.alertId}`,
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
