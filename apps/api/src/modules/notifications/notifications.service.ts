import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './entities/notification.entity';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  QueryNotificationDto,
} from './dto/create-notification.dto';
import { OutboxService } from '../outbox/outbox.service';
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from '../../common/pagination';

const NOTIFICATION_READ_PROJECTION =
  '_id userId type title message isRead readAt attachments metadata expiresAt createdAt updatedAt';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private readonly outbox: OutboxService,
    @Optional() @InjectConnection() private readonly connection?: Connection,
  ) {}

  private mapGatewayNotification(notification: NotificationDocument) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      type: notification.type,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    };
  }

  private async enqueueRealtime(
    userId: string,
    action: 'mark_read' | 'mark_all_read' | 'deleted',
    notification?: NotificationDocument,
  ) {
    const aggregateId = notification?._id ?? new Types.ObjectId(userId);
    await this.outbox.enqueue({
      eventType: 'notification.realtime',
      aggregateType: 'notification',
      aggregateId,
      idempotencyKey: `notification.${action}.${notification?._id ?? userId}.${notification?.updatedAt?.getTime() ?? Date.now()}`,
      payload: {
        userId,
        action,
        notification: notification
          ? this.mapGatewayNotification(notification)
          : undefined,
      },
    });
  }

  /**
   * 📝 TẠO THÔNG BÁO MỚI
   */
  async create(userId: string, dto: CreateNotificationDto) {
    if (!Types.ObjectId.isValid(dto.userId)) {
      throw new BadRequestException('Invalid recipient user ID');
    }

    if (!this.connection) {
      const notification = await this.notificationModel.create({
        userId: new Types.ObjectId(dto.userId),
        type: dto.type,
        title: dto.title,
        message: dto.message,
        isRead: false,
        idempotencyKey: dto.idempotencyKey,
      });
      await this.outbox.enqueue({
        eventType: 'notification.created',
        aggregateType: 'notification',
        aggregateId: notification._id,
        idempotencyKey: `notification.created.${notification._id}`,
        payload: {
          userId: dto.userId.toString(),
          action: 'send',
          notification: this.mapGatewayNotification(notification),
        },
      });
      return {
        statusCode: 201,
        message: 'Notification created successfully',
        data: notification,
      };
    }
    const session = await this.connection.startSession();
    let notification!: NotificationDocument;
    try {
      await session.withTransaction(async () => {
        if (dto.idempotencyKey) {
          const existing = await this.notificationModel
            .findOne({ idempotencyKey: dto.idempotencyKey })
            .session(session)
            .exec();
          if (existing) {
            notification = existing;
            return;
          }
        }
        [notification] = await this.notificationModel.create(
          [
            {
              userId: new Types.ObjectId(dto.userId),
              type: dto.type,
              title: dto.title,
              message: dto.message,
              isRead: false,
              idempotencyKey: dto.idempotencyKey,
            },
          ],
          { session },
        );
        await this.outbox.enqueue(
          {
            eventType: 'notification.created',
            aggregateType: 'notification',
            aggregateId: notification._id,
            idempotencyKey: `notification.created.${notification._id}`,
            payload: {
              userId: dto.userId.toString(),
              action: 'send',
              notification: this.mapGatewayNotification(notification),
            },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      statusCode: 201,
      message: 'Notification created successfully',
      data: notification,
    };
  }

  /**
   * 📬 LẤY TẤT CẢ THÔNG BÁO CỦA USER
   */
  async findAll(userId: string, query: QueryNotificationDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const filter: any = {
      userId: new Types.ObjectId(userId),
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.unreadOnly) {
      filter.isRead = false;
    }

    const cursorFilter: Record<string, unknown> = { ...filter };
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || -1;
    if (query.cursor) {
      try {
        const cursor = decodeCursor(query.cursor);
        const date = new Date(cursor.sortValue);
        if (Number.isNaN(date.getTime())) throw new InvalidCursorError();
        const operator = sortOrder === 1 ? '$gt' : '$lt';
        cursorFilter.$or = [
          { [sortField]: { [operator]: date } },
          {
            [sortField]: date,
            _id: { [operator]: new Types.ObjectId(cursor.id) },
          },
        ];
      } catch (error) {
        if (error instanceof InvalidCursorError)
          throw new BadRequestException('Invalid notification cursor');
        throw error;
      }
    }
    const skip = query.cursor ? 0 : (query.page - 1) * query.limit;
    const sort: any = {};
    sort[sortField] = sortOrder;
    sort._id = sortOrder;

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(cursorFilter)
        .select(NOTIFICATION_READ_PROJECTION)
        .sort(sort)
        .skip(skip)
        .limit(query.limit + 1)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    const hasNextPage = data.length > query.limit;
    const notifications = hasNextPage ? data.slice(0, query.limit) : data;
    const last = notifications.at(-1) as
      | { _id?: Types.ObjectId; createdAt?: Date; readAt?: Date }
      | undefined;
    const sortValue = last?.[sortField];
    return {
      statusCode: 200,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        hasNextPage,
        nextCursor:
          hasNextPage && last?._id && sortValue
            ? encodeCursor({
                sortValue: sortValue.toISOString(),
                id: String(last._id),
              })
            : null,
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    };
  }

  /**
   * 👁️ LẤY CHI TIẾT THÔNG BÁO
   */
  async findOne(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const notification = await this.notificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Mark as read
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();

      await this.enqueueRealtime(userId.toString(), 'mark_read', notification);
    }

    return {
      statusCode: 200,
      message: 'Notification retrieved successfully',
      data: notification,
    };
  }

  /**
   * ✏️ CẬP NHẬT THÔNG BÁO
   */
  async update(
    userId: string,
    notificationId: string,
    dto: UpdateNotificationDto,
  ) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const notification = await this.notificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (dto.read !== undefined) {
      notification.isRead = dto.read;
    }

    await notification.save();

    if (dto.read !== undefined) {
      await this.enqueueRealtime(userId.toString(), 'mark_read', notification);
    }

    return {
      statusCode: 200,
      message: 'Notification updated successfully',
      data: notification,
    };
  }

  /**
   * 📌 ĐÁNH DẤU TẤT CẢ LÀ ĐÃ ĐỌC
   */
  async markAllAsRead(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const result = await this.notificationModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    if (result.modifiedCount > 0) {
      await this.enqueueRealtime(userId, 'mark_all_read');
    }

    return {
      statusCode: 200,
      message: `${result.modifiedCount} notifications marked as read`,
      data: { modifiedCount: result.modifiedCount },
    };
  }

  /**
   * ✅ ĐÁNH DẤU MỘT THÔNG BÁO LÀ ĐÃ ĐỌC
   */
  async markAsRead(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const notification = await this.notificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.enqueueRealtime(userId.toString(), 'mark_read', notification);

    return {
      statusCode: 200,
      message: 'Notification marked as read',
      data: notification,
    };
  }

  /**
   * 🗑️ XÓA THÔNG BÁO
   */
  async delete(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new BadRequestException('Invalid notification ID');
    }

    const result = await this.notificationModel.findOneAndDelete({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!result) {
      throw new NotFoundException('Notification not found');
    }

    await this.enqueueRealtime(userId.toString(), 'deleted', result);

    return {
      statusCode: 200,
      message: 'Notification deleted successfully',
    };
  }

  /**
   * 📊 ĐẾM THÔNG BÁO CHƯA ĐỌC
   */
  async countUnread(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const count = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });

    return {
      statusCode: 200,
      message: 'Unread count retrieved',
      data: { unreadCount: count },
    };
  }
}
