import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EmailModule } from '../../infrastructure/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ModerationModule } from '../moderation/moderation.module';
import { UserProfileController } from './user-profile.controller';
import { UserProfileQueryService } from './user-profile-query.service';

@Module({
  imports: [
    NotificationsModule,
    UsersModule,
    ConsultationsModule,
    ModerationModule,
    EmailModule,
  ],
  controllers: [AdminController, UserProfileController],
  providers: [AdminService, UserProfileQueryService],
  exports: [AdminService],
})
export class AdministrationModule {}
