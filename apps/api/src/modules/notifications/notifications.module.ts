import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './application/services/notifications.service';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { NotificationsGateway } from './presentation/gateways/notifications.gateway';
import {
  Notification,
  NotificationSchema,
} from './domain/entities/notification.entity';
import { PresenceModule } from '../../infrastructure/realtime/presence/presence.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    PresenceModule,
    OutboxModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
