import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
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
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { AdminModule } from './modules/admin/admin.module';
import { ViolationsModule } from './modules/violations/violations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
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
    AiAssistantModule,
    AdminModule,
    ViolationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
