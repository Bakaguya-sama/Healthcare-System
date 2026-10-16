import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import {
  Consultation,
  ConsultationSchema,
} from './domain/entities/consultations/consultation.entity';
import { ConsultationsService } from './application/services/consultations/consultations.service';
import { ConsultationsController } from './presentation/controllers/consultations/consultations.controller';
import { ConsultationsGateway } from './presentation/gateways/consultations/consultations.gateway';
import { FilesModule } from '../../infrastructure/files/files.module';
import { PresenceModule } from '../../infrastructure/realtime/presence/presence.module';
import { WsThrottleGuard } from '../../core/throttling/ws-throttle.guard';
import { ChatController } from './presentation/controllers/messaging/chat.controller';
import { ChatGateway } from './presentation/gateways/messaging/chat.gateway';
import { ChatService } from './application/services/messaging/chat.service';
import { Message, MessageSchema } from './domain/entities/messaging/message.entity';
import { ReviewsController } from './presentation/controllers/reviews/reviews.controller';
import { ReviewsService } from './application/services/reviews/reviews.service';
import { Review, ReviewSchema } from './domain/entities/reviews/review.entity';
import { ConsultationHeartbeatService } from './application/services/consultations/consultation-heartbeat.service';
import { CARE_REPORT_PORT } from './application/ports/care-report.port';
import { CARE_ALERT_CONSULTATION_PORT } from './application/ports/care-alert-consultation.port';
import { CareAlertConsultationService } from './application/services/consultations/care-alert-consultation.service';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    FilesModule,
    PresenceModule,
    PlatformAuditModule,
    OutboxModule,
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
    ConsultationHeartbeatService,
    CareAlertConsultationService,
    ChatService,
    ChatGateway,
    ReviewsService,
    WsThrottleGuard,
    {
      provide: CARE_REPORT_PORT,
      useExisting: ConsultationsService,
    },
    {
      provide: CARE_ALERT_CONSULTATION_PORT,
      useExisting: CareAlertConsultationService,
    },
  ],
  exports: [
    ConsultationsService,
    ChatService,
    ReviewsService,
    CARE_REPORT_PORT,
    CARE_ALERT_CONSULTATION_PORT,
  ],
})
export class ConsultationsModule {}
