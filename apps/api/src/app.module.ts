import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AdminsModule } from './modules/admins/admins.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiFeedbacksModule } from './modules/ai-feedbacks/ai-feedbacks.module';
import { AiDocumentsModule } from './modules/ai-documents/ai-documents.module';
import { AiDocumentChunksModule } from './modules/ai-document-chunks/ai-document-chunks.module';
import { BlacklistKeywordsModule } from './modules/blacklist-keywords/blacklist-keywords.module';
import { HealthMetricsModule } from './modules/health-metrics/health-metrics.module';
import { ConsultationsModule } from './modules/consultations/consultations.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AdminModule } from './modules/admin/admin.module';
import { ViolationsModule } from './modules/violations/violations.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { PresenceModule } from './modules/presence/presence.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { CacheModule } from './common/cache/cache.module';
import { validateEnvironment } from './config/environment.validation';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { AuthCoreModule } from './core/auth-core/auth-core.module';
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
    AuthCoreModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AdminsModule,
    NotificationsModule,
    AiFeedbacksModule,
    AiDocumentsModule,
    AiDocumentChunksModule,
    BlacklistKeywordsModule,
    HealthMetricsModule,
    ConsultationsModule,
    ChatModule,
    ReviewsModule,
    AdminModule,
    ViolationsModule,
    AiAssistantModule,
    PresenceModule,
    CloudinaryModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ProxyThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
