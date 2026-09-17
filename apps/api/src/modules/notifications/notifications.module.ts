import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { UploadController } from '../cloudinary/upload.controller';
import {
  Notification,
  NotificationSchema,
} from './entities/notification.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    PresenceModule,
  ],
  controllers: [NotificationsController, UploadController],
  providers: [NotificationsService, NotificationsGateway, CloudinaryService],
  exports: [NotificationsService, NotificationsGateway, CloudinaryService],
})
export class NotificationsModule {}
