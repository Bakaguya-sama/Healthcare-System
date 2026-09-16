import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';
import { PageSortQueryDto } from '../../../common/pagination';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'User ID to receive notification (Admin/Doctor only)',
    example: 'user_id_here',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.INFO,
  })
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'Alert',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'This is a notification message',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  message: string;
}

export class UpdateNotificationDto {
  @ApiProperty({
    description: 'Mark as read',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

export const NOTIFICATION_SORT_FIELDS = ['createdAt', 'readAt'] as const;
export type NotificationSortField = (typeof NOTIFICATION_SORT_FIELDS)[number];

export class QueryNotificationDto extends PageSortQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiProperty({
    required: false,
    enum: NOTIFICATION_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(NOTIFICATION_SORT_FIELDS)
  sortBy: NotificationSortField = 'createdAt';
}
