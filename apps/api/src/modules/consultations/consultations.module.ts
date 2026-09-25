import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import {
  Consultation,
  ConsultationSchema,
} from './entities/consultation.entity';
import { ConsultationsService } from './consultations.service';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsGateway } from './consultations.gateway';
import { FilesModule } from '../../infrastructure/files/files.module';
import { PresenceModule } from '../../infrastructure/realtime/presence/presence.module';
import { WsThrottleGuard } from '../../core/throttling/ws-throttle.guard';
import { ChatController } from './messaging/chat.controller';
import { ChatGateway } from './messaging/chat.gateway';
import { ChatService } from './messaging/chat.service';
import { Message, MessageSchema } from './messaging/entities/message.entity';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { Review, ReviewSchema } from './reviews/entities/review.entity';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    FilesModule,
    PresenceModule,
    MongooseModule.forFeature([
      { name: Consultation.name, schema: ConsultationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],
  controllers: [ConsultationsController, ChatController, ReviewsController],
  providers: [
    ConsultationsService,
    ConsultationsGateway,
    ChatService,
    ChatGateway,
    ReviewsService,
    WsThrottleGuard,
  ],
  exports: [ConsultationsService, ChatService, ReviewsService],
})
export class ConsultationsModule {}
