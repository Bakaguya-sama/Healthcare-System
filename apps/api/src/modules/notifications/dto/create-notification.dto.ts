import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  MaxLength,
  IsDate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { NotificationType, NotificationStatus } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.HEALTH_ALERT,
  })
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title',
    example: 'Blood Pressure Alert',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your blood pressure is higher than normal: 150/90 mmHg',
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  message: string;

  @ApiProperty({
    description: 'Related resource ID',
    required: false,
    example: '65e456def789abc012345678',
  })
  @IsOptional()
  @IsString()
  relatedId?: string;

  @ApiProperty({
    description: 'Related resource type',
    required: false,
    example: 'health_metric',
  })
  @IsOptional()
  @IsString()
  relatedType?: string;

  @ApiProperty({
    description: 'Additional data as JSON',
    required: false,
    example: { metricType: 'blood_pressure', value: 150 },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Expiration time for notification',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;
}

export class UpdateNotificationDto {
  @ApiProperty({
    enum: NotificationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryNotificationDto {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  page: number = 1;

  @ApiProperty({ required: false, example: 20 })
  @IsOptional()
  limit: number = 20;

  @ApiProperty({
    enum: NotificationStatus,
    required: false,
    description: 'Filter by status',
  })
  @IsOptional()
  status?: NotificationStatus;

  @ApiProperty({
    required: false,
    description: 'Filter unread only',
  })
  @IsOptional()
  unreadOnly?: boolean;

  @ApiProperty({
    enum: NotificationType,
    required: false,
    description: 'Filter by type',
  })
  @IsOptional()
  type?: NotificationType;

  @ApiProperty({ required: false, description: 'Sort field' })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ required: false, description: 'Sort order: 1 or -1' })
  @IsOptional()
  sortOrder?: number;
}
