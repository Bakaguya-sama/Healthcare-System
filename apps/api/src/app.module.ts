import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AdminsModule } from './modules/admins/admins.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiSessionsModule } from './modules/ai-sessions/ai-sessions.module';
import { AiMessagesModule } from './modules/ai-messages/ai-messages.module';
import { AiFeedbacksModule } from './modules/ai-feedbacks/ai-feedbacks.module';
import { AiDocumentsModule } from './modules/ai-documents/ai-documents.module';
import { AiDocumentChunksModule } from './modules/ai-document-chunks/ai-document-chunks.module';
import { BlacklistKeywordsModule } from './modules/blacklist-keywords/blacklist-keywords.module';
import { AiHealthInsightsModule } from './modules/ai-health-insights/ai-health-insights.module';
import { HealthMetricsModule } from './modules/health-metrics/health-metrics.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { ChatModule } from './modules/chat/chat.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AdminModule } from './modules/admin/admin.module';
import { ViolationsModule } from './modules/violations/violations.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { PresenceModule } from './modules/presence/presence.module';
import { CacheModule } from './common/cache/cache.module';
import { validateEnvironment } from './config/environment.validation';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { AuthCoreModule } from './core/auth-core/auth-core.module';
import { ProxyThrottlerGuard } from './core/throttling/proxy-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('HTTP_THROTTLE_TTL_MS'),
          limit: config.getOrThrow<number>('HTTP_THROTTLE_LIMIT'),
        },
      ],
    }),
    CacheModule,
    AuthCoreModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AdminsModule,
    NotificationsModule,
    AiSessionsModule,
    AiMessagesModule,
    AiFeedbacksModule,
    AiDocumentsModule,
    AiDocumentChunksModule,
    BlacklistKeywordsModule,
    AiHealthInsightsModule,
    HealthMetricsModule,
    SessionsModule,
    ChatModule,
    ReviewsModule,
    AdminModule,
    ViolationsModule,
    AiAssistantModule,
    PresenceModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ProxyThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
