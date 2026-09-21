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

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService, ConsultationsGateway],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
