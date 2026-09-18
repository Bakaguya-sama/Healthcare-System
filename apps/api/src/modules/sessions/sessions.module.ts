import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session, SessionSchema } from './entities/session.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SessionsGateway } from './sessions.gateway';
import { Consultation, ConsultationSchema } from './entities/consultation.entity';
import { ConsultationsService } from './consultations.service';
import { ConsultationsController } from './consultations.controller';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
  ],
  controllers: [SessionsController, ConsultationsController],
  providers: [ConsultationsService, SessionsService, SessionsGateway],
})
export class SessionsModule {}
