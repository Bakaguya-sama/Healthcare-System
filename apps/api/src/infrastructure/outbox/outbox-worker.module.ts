import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.validation';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { OutboxModule } from './outbox.module';
import { OutboxWorkerService } from './outbox-worker.service';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    OutboxModule,
    NotificationsModule,
  ],
  providers: [OutboxWorkerService],
})
export class OutboxWorkerModule {}
