import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiAdvisoryModule } from './modules/ai-advisory/ai-advisory.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { HealthTrackingModule } from './modules/health-tracking/health-tracking.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { FilesModule } from './infrastructure/files/files.module';
import { CacheModule } from './common/cache/cache.module';
import { validateEnvironment } from './config/environment.validation';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { ProxyThrottlerGuard } from './core/throttling/proxy-throttler.guard';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './infrastructure/health/health.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RedisThrottlerStorage } from './infrastructure/redis/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          {
            ttl: config.getOrThrow<number>('HTTP_THROTTLE_TTL_MS'),
            limit: config.getOrThrow<number>('HTTP_THROTTLE_LIMIT'),
          },
        ],
      }),
    }),
    CacheModule,
    HealthModule,
    AuthenticationModule,
    UsersModule,
    NotificationsModule,
    ModerationModule,
    HealthTrackingModule,
    ConsultationsModule,
    AdministrationModule,
    AiAdvisoryModule,
    FilesModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ProxyThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
