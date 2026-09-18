import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.validation';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { OutboxModule } from './outbox.module';
import { OutboxWorkerService } from './outbox-worker.service';
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
  ],
  providers: [OutboxWorkerService],
})
export class OutboxWorkerModule {}
