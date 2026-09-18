import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { Message, MessageSchema } from './entities/message.entity';
import { Session, SessionSchema } from '../sessions/entities/session.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PresenceModule } from '../presence/presence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WsThrottleGuard } from '../../core/throttling/ws-throttle.guard';
import { Consultation, ConsultationSchema } from '../sessions/entities/consultation.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    PresenceModule,
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, CloudinaryService, WsThrottleGuard],
})
export class ChatModule {}
