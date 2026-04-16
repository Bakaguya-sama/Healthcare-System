import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { UploadController } from '../cloudinary/upload.controller';
import {
  Notification,
  NotificationSchema,
} from './entities/notification.entity';
import { CloudinaryService } from '../../core/services/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    // ✅ Import JWT Module for WebSocket auth
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '30m',
        },
      }),
    }),
  ],
  controllers: [NotificationsController, UploadController],
  providers: [
    NotificationsService,
    NotificationsGateway, // ✅ WebSocket Gateway
    CloudinaryService, // ✅ Cloudinary Service
  ],
  exports: [NotificationsService, NotificationsGateway, CloudinaryService],
})
export class NotificationsModule {}
