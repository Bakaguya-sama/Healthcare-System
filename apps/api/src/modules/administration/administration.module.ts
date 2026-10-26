import { Module } from '@nestjs/common';
import { AdminController } from './presentation/controllers/admin.controller';
import { AdminService } from './application/services/admin.service';
import { EmailModule } from '../../infrastructure/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ModerationModule } from '../moderation/moderation.module';
import { UserProfileController } from './presentation/controllers/user-profile.controller';
import { UserProfileQueryService } from './application/services/user-profile-query.service';

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
