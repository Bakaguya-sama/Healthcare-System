import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationsService,
  NotificationType,
} from '../../../notifications/public-api';
import { FamilyLink, FamilyLinkDocument } from '../mongoose/family-link.schema';
import {
  FamilyHealthMetricSharing,
  FamilyHealthMetricSharingDocument,
} from '../mongoose/family-health-metric-sharing.schema';

@Injectable()
export class FamilyHealthSharingNotificationService {
  constructor(
    @InjectModel(FamilyLink.name)
    private readonly links: Model<FamilyLinkDocument>,
    @InjectModel(FamilyHealthMetricSharing.name)
    private readonly sharings: Model<FamilyHealthMetricSharingDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  async deliver(input: {
    familyLinkId: string;
    invitationVersion: number;
    revision: number;
  }) {
    if (
      !Types.ObjectId.isValid(input.familyLinkId) ||
      !Number.isInteger(input.invitationVersion) ||
      !Number.isInteger(input.revision)
    )
      throw new Error('INVALID_FAMILY_SHARING_EVENT');
    const link = await this.links
      .findOne({
        _id: new Types.ObjectId(input.familyLinkId),
        status: 'active',
        invitationVersion: input.invitationVersion,
      })
      .lean()
      .exec();
    if (!link?.familyUserId) return;
    const active = await this.sharings.exists({
      familyLinkId: link._id,
      invitationVersion: input.invitationVersion,
      revision: input.revision,
      status: 'active',
      familyUserId: link.familyUserId,
    });
    if (!active) return;
    const recipient = String(link.familyUserId);
    await this.notifications.create(recipient, {
      userId: recipient,
      type: NotificationType.INFO,
      title: 'Quyền xem chỉ số sức khỏe',
      message: 'Người bạn hỗ trợ đã cập nhật quyền xem chỉ số sức khỏe của họ.',
      idempotencyKey: `family.health-sharing.notification.${input.familyLinkId}.${input.invitationVersion}.${input.revision}`,
    });
  }
}
