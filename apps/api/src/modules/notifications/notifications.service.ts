import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './entities/notification.entity';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  QueryNotificationDto,
} from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  /**
   * 📝 TẠO THÔNG BÁO MỚI
   */
  async create(userId: string, dto: CreateNotificationDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      type: dto.type,
      title: dto.title,
      message: dto.message,
      relatedId: dto.relatedId ? new Types.ObjectId(dto.relatedId) : undefined,
      relatedType: dto.relatedType,
      data: dto.data,
      expiresAt: dto.expiresAt,
      read: false,
      isActive: true,
    });

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
      isActive: true,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.unreadOnly) {
      filter.read = false;
    }

    const skip = (query.page - 1) * query.limit;
    const sort: any = {};
    sort[query.sortBy || 'createdAt'] = query.sortOrder || -1;

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      statusCode: 200,
      message: 'Notifications retrieved successfully',
      data: {
        notifications: data,
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
    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
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

    if (dto.status) {
      notification.status = dto.status;
    }

    if (dto.read !== undefined) {
      notification.read = dto.read;
      if (dto.read && !notification.readAt) {
        notification.readAt = new Date();
      }
    }

    if (dto.isActive !== undefined) {
      notification.isActive = dto.isActive;
    }

    await notification.save();

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
        read: false,
      },
      {
        read: true,
        readAt: new Date(),
      },
    );

    return {
      statusCode: 200,
      message: `${result.modifiedCount} notifications marked as read`,
      data: { modifiedCount: result.modifiedCount },
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
      read: false,
      isActive: true,
    });

    return {
      statusCode: 200,
      message: 'Unread count retrieved',
      data: { unreadCount: count },
    };
  }
}
