import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import {
  AiConversation,
  AiConversationSchema,
} from './entities/ai-conversation.entity';
import {
  AiConversationMessage,
  AiConversationMessageSchema,
} from './entities/ai-conversation-message.entity';
import { RagModule } from '../rag/rag.module';
import { HealthMetricsModule } from '../health-metrics/health-metrics.module';

import { MedicalAnsweringService } from './services/medical-answering.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { LlmGatewayService } from './services/llm-gateway.service';
import { BlacklistKeywordsModule } from '../blacklist-keywords/blacklist-keywords.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AiResponseOrchestrator } from './services/ai-response-orchestrator.service';
import { AiSafetyService } from './services/ai-safety.service';

@Module({
  imports: [
    RagModule,
    HealthMetricsModule,
    BlacklistKeywordsModule,
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiConversationMessage.name, schema: AiConversationMessageSchema },
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    MedicalAnsweringService,
    PromptBuilderService,
    LlmGatewayService,
    CloudinaryService,
    AiResponseOrchestrator,
    AiSafetyService,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
