import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { Message, MessageSchema } from './entities/message.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PresenceModule } from '../presence/presence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WsThrottleGuard } from '../../core/throttling/ws-throttle.guard';
import { ConsultationsModule } from '../consultations/consultations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    ConsultationsModule,
    PresenceModule,
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, CloudinaryService, WsThrottleGuard],
})
export class ChatModule {}
