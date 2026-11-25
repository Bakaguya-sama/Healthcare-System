import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import {
  NotificationsService,
  NotificationType,
} from '../../../notifications/public-api';
import { FamilyLink, FamilyLinkDocument } from './family-link.schema';
import {
  FamilyPermission,
  FamilyPermissionDocument,
} from './family-permission.schema';
import {
  FamilyReminder,
  FamilyReminderDocument,
} from './family-reminder.schema';
import {
  FamilyReminderQuota,
  FamilyReminderQuotaDocument,
} from './family-reminder-quota.schema';
import {
  CARE_TASK_REMINDER_READER,
  CareTaskStatus,
} from '../../../chronic-care/public-api';
import type { CareTaskReminderReader } from '../../../chronic-care/public-api';
import {
  FamilyReminderCandidate,
  FamilyReminderDeliveryStore,
  FamilyReminderDispatchResult,
  FamilyReminderSkipReason,
  ScheduleFamilyReminderInput,
} from '../../application/ports/family-reminder-delivery.store';

@Injectable()
export class MongooseFamilyReminderDeliveryStore implements FamilyReminderDeliveryStore {
  constructor(
    @InjectModel(FamilyReminder.name)
    private readonly reminders: Model<FamilyReminderDocument>,
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
    @InjectModel(FamilyPermission.name)
    private readonly permissions: Model<FamilyPermissionDocument>,
    @InjectModel(FamilyReminderQuota.name)
    private readonly quotas: Model<FamilyReminderQuotaDocument>,
    private readonly notifications: NotificationsService,
    private readonly outbox: OutboxService,
    @InjectConnection() private readonly connection: Connection,
    @Inject(CARE_TASK_REMINDER_READER)
    private readonly careTaskReader: CareTaskReminderReader,
  ) {}

  async listActiveRecipients(
    patientId: string | undefined,
    permission: 'missed_task_reminder' | 'weekly_progress',
  ) {
    const links = await this.links
      .find({
        ...(patientId ? { patientId: new Types.ObjectId(patientId) } : {}),
        status: 'active',
        familyUserId: { $exists: true },
        permissions: permission,
      })
      .select('_id patientId familyUserId')
      .lean()
      .exec();
    const recipients: Array<{
      familyLinkId: string;
      patientId: string;
      familyUserId: string;
      permissionId: string;
    }> = [];
    for (const link of links) {
      const activePermission = await this.permissions
        .findOne({
          familyLinkId: link._id,
          status: 'active',
          permissions: permission,
        })
        .sort({ createdAt: -1 })
        .select('_id')
        .lean()
        .exec();
      if (!activePermission || !link.familyUserId) continue;
      recipients.push({
        familyLinkId: String(link._id),
        patientId: String(link.patientId),
        familyUserId: String(link.familyUserId),
        permissionId: String(activePermission._id),
      });
    }
    return recipients;
  }

  async scheduleReminder(input: ScheduleFamilyReminderInput) {
    const session = await this.connection.startSession();
    let reminderId = '';
    try {
      await session.withTransaction(async () => {
        const uniqueKey = input.uniqueKey;
        const reminder = await this.reminders
          .findOneAndUpdate(
            { uniqueKey },
            {
              $setOnInsert: {
                patientId: new Types.ObjectId(input.patientId),
                familyLinkId: new Types.ObjectId(input.familyLinkId),
                permissionId: new Types.ObjectId(input.permissionId),
                careTaskId: input.careTaskId
                  ? new Types.ObjectId(input.careTaskId)
                  : undefined,
                reminderType: input.reminderType,
                uniqueKey,
                status: 'scheduled',
                scheduledAt: input.scheduledAt,
                patientTimeZone: input.patientTimeZone,
              },
            },
            { upsert: true, returnDocument: 'after', session },
          )
          .exec();
        if (!reminder) throw new Error('Family reminder could not be stored');
        reminderId = String(reminder._id);
        await this.outbox.enqueue(
          {
            eventType: 'family.reminder.dispatch.v1',
            aggregateType: 'FamilyReminder',
            aggregateId: reminder._id,
            idempotencyKey: `family.reminder.dispatch.${uniqueKey}`,
            availableAt: reminder.scheduledAt,
            payload: {
              familyReminderId: String(reminder._id),
              familyLinkId: String(reminder.familyLinkId),
              ...(reminder.careTaskId
                ? { taskId: String(reminder.careTaskId) }
                : {}),
            },
          },
          session,
        );
      });
      return reminderId;
    } finally {
      await session.endSession();
    }
  }

  async findReminder(
    reminderId: string,
  ): Promise<FamilyReminderCandidate | null> {
    if (!Types.ObjectId.isValid(reminderId)) return null;
    const reminder = await this.reminders.findById(reminderId).lean().exec();
    if (!reminder) return null;
    return {
      id: String(reminder._id),
      patientId: String(reminder.patientId),
      familyLinkId: String(reminder.familyLinkId),
      permissionId: String(reminder.permissionId),
      ...(reminder.careTaskId
        ? { careTaskId: String(reminder.careTaskId) }
        : {}),
      reminderType: reminder.reminderType as 'missed_task' | 'weekly_progress',
      uniqueKey: reminder.uniqueKey,
      scheduledAt: reminder.scheduledAt,
      status: reminder.status as 'scheduled' | 'dispatched' | 'skipped',
    };
  }

  async skipReminder(
    reminderId: string,
    outboxEventId: string,
    reason: FamilyReminderSkipReason,
  ) {
    if (
      !Types.ObjectId.isValid(reminderId) ||
      !Types.ObjectId.isValid(outboxEventId)
    )
      return;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.reminders.updateOne(
          { _id: new Types.ObjectId(reminderId), status: 'scheduled' },
          { $set: { status: 'skipped', skipReason: reason } },
          { session },
        );
        await this.acknowledgeDispatchEvent(
          new Types.ObjectId(outboxEventId),
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async deferDispatch(
    reminderId: string,
    outboxEventId: string,
    scheduledAt: Date,
  ) {
    if (
      !Types.ObjectId.isValid(reminderId) ||
      !Types.ObjectId.isValid(outboxEventId)
    )
      return false;
    const session = await this.connection.startSession();
    let deferred = false;
    try {
      await session.withTransaction(async () => {
        const reminderUpdate = await this.reminders.updateOne(
          { _id: new Types.ObjectId(reminderId), status: 'scheduled' },
          { $set: { scheduledAt } },
          { session },
        );
        if (reminderUpdate.modifiedCount !== 1) return;
        const outboxUpdate = await this.outbox.deferUntil(
          new Types.ObjectId(outboxEventId),
          scheduledAt,
          session,
        );
        if (outboxUpdate.modifiedCount !== 1)
          throw new Error('Family reminder dispatch event is not processing');
        deferred = true;
      });
      return deferred;
    } finally {
      await session.endSession();
    }
  }

  async dispatchReminder(input: {
    reminderId: string;
    outboxEventId: string;
    now: Date;
    quotaWindowMs: number;
  }): Promise<FamilyReminderDispatchResult> {
    return this.dispatchReminderInTransaction(input, true);
  }

  private async dispatchReminderInTransaction(
    input: {
      reminderId: string;
      outboxEventId: string;
      now: Date;
      quotaWindowMs: number;
    },
    retryQuotaCreationRace: boolean,
  ): Promise<FamilyReminderDispatchResult> {
    if (!Types.ObjectId.isValid(input.reminderId))
      return { outcome: 'already_processed' };
    const session = await this.connection.startSession();
    let result: FamilyReminderDispatchResult = {
      outcome: 'already_processed',
    };
    let retryAfterDuplicateQuotaInsert = false;
    try {
      await session.withTransaction(async () => {
        const reminder = await this.reminders
          .findOne({
            _id: new Types.ObjectId(input.reminderId),
            status: 'scheduled',
            scheduledAt: { $lte: input.now },
          })
          .session(session)
          .exec();
        if (!reminder) {
          result = { outcome: 'already_processed' };
          return;
        }
        const requiredPermission =
          reminder.reminderType === 'missed_task'
            ? 'missed_task_reminder'
            : 'weekly_progress';
        const link = await this.links
          .findOne({
            _id: reminder.familyLinkId,
            status: 'active',
            familyUserId: { $exists: true },
            permissions: requiredPermission,
          })
          .select('familyUserId')
          .session(session)
          .lean()
          .exec();
        if (!link?.familyUserId) {
          await this.reminders.updateOne(
            { _id: reminder._id, status: 'scheduled' },
            { $set: { status: 'skipped', skipReason: 'link_not_active' } },
            { session },
          );
          result = { outcome: 'skipped', reason: 'link_not_active' };
          await this.acknowledgeDispatchEvent(
            new Types.ObjectId(input.outboxEventId),
            session,
          );
          return;
        }
        const permission = await this.permissions
          .findOne({
            _id: reminder.permissionId,
            familyLinkId: reminder.familyLinkId,
            status: 'active',
            permissions: requiredPermission,
          })
          .select('_id')
          .session(session)
          .lean()
          .exec();
        if (!permission) {
          await this.reminders.updateOne(
            { _id: reminder._id, status: 'scheduled' },
            {
              $set: {
                status: 'skipped',
                skipReason: 'permission_not_active',
              },
            },
            { session },
          );
          result = { outcome: 'skipped', reason: 'permission_not_active' };
          await this.acknowledgeDispatchEvent(
            new Types.ObjectId(input.outboxEventId),
            session,
          );
          return;
        }

        if (reminder.reminderType === 'missed_task') {
          const eligibility = reminder.careTaskId
            ? await this.careTaskReader.readReminderEligibility({
                taskId: String(reminder.careTaskId),
                patientId: String(reminder.patientId),
              })
            : null;
          const skipReason =
            !eligibility ||
            eligibility.taskStatus !== CareTaskStatus.MISSED ||
            !eligibility.required
              ? 'task_not_missed'
              : eligibility.enrollmentStatus !== 'active'
                ? 'enrollment_not_active'
                : null;
          if (skipReason) {
            await this.reminders.updateOne(
              { _id: reminder._id, status: 'scheduled' },
              { $set: { status: 'skipped', skipReason } },
              { session },
            );
            result = { outcome: 'skipped', reason: skipReason };
            await this.acknowledgeDispatchEvent(
              new Types.ObjectId(input.outboxEventId),
              session,
            );
            return;
          }
        }

        const companionUserId = link.familyUserId;
        if (reminder.reminderType === 'missed_task') {
          await this.quotas.updateOne(
            { companionUserId },
            { $setOnInsert: { companionUserId } },
            { upsert: true, session },
          );
          const quota = await this.quotas.findOneAndUpdate(
            {
              companionUserId,
              $expr: {
                $or: [
                  {
                    $eq: [{ $type: '$lastMissedTaskDispatchedAt' }, 'missing'],
                  },
                  {
                    $lte: [
                      '$lastMissedTaskDispatchedAt',
                      {
                        $dateSubtract: {
                          startDate: '$$NOW',
                          unit: 'millisecond',
                          amount: input.quotaWindowMs,
                        },
                      },
                    ],
                  },
                ],
              },
            },
            [
              {
                $set: {
                  lastMissedTaskDispatchedAt: '$$NOW',
                  updatedAt: '$$NOW',
                },
              },
            ],
            { returnDocument: 'after', updatePipeline: true, session },
          );
          if (!quota) {
            const currentQuota = await this.quotas
              .findOne({ companionUserId })
              .select('lastMissedTaskDispatchedAt')
              .session(session)
              .lean()
              .exec();
            if (!currentQuota?.lastMissedTaskDispatchedAt)
              throw new Error('Family reminder quota state unavailable');
            result = {
              outcome: 'quota_limited',
              lastDispatchedAt: currentQuota.lastMissedTaskDispatchedAt,
            };
            return;
          }
        }

        const isMissedTask = reminder.reminderType === 'missed_task';
        const notification = await this.notifications.create(
          String(companionUserId),
          {
            userId: String(companionUserId),
            type: NotificationType.INFO,
            title: isMissedTask
              ? 'Nhắc hỗ trợ người thân'
              : 'Cập nhật tiến độ hỗ trợ',
            message: isMissedTask
              ? 'Người bạn hỗ trợ chưa hoàn thành một nhiệm vụ theo dõi hôm nay.'
              : 'Đã có cập nhật tổng quát hằng tuần trong ứng dụng.',
            idempotencyKey: `family.reminder.notification.${reminder.uniqueKey}`,
          },
          session,
        );
        const notificationId =
          notification?.data?._id ?? notification?.data?.id;
        const updated = await this.reminders.updateOne(
          { _id: reminder._id, status: 'scheduled' },
          {
            $set: {
              status: 'dispatched',
              dispatchedAt: input.now,
              notificationId: notificationId
                ? new Types.ObjectId(String(notificationId))
                : undefined,
            },
          },
          { session },
        );
        if (updated.modifiedCount !== 1)
          throw new Error('Family reminder state changed during dispatch');
        await this.acknowledgeDispatchEvent(
          new Types.ObjectId(input.outboxEventId),
          session,
        );
        result = { outcome: 'dispatched' };
      });
    } catch (error) {
      if (
        retryQuotaCreationRace &&
        (error as { code?: number })?.code === 11000
      ) {
        retryAfterDuplicateQuotaInsert = true;
      } else {
        throw error;
      }
    } finally {
      await session.endSession();
    }
    if (retryAfterDuplicateQuotaInsert)
      return this.dispatchReminderInTransaction(input, false);
    return result;
  }

  private async acknowledgeDispatchEvent(
    eventId: Types.ObjectId,
    session: ClientSession,
  ) {
    const update = await this.outbox.markDelivered(eventId, session);
    if (update.modifiedCount === 1) return;
    const status = await this.outbox.getStatusById(eventId, session);
    if (status !== 'delivered')
      throw new Error('Family reminder dispatch event is not processing');
  }
}
