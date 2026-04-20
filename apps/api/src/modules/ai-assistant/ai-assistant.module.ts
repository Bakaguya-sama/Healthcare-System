import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import {
  AiConversation,
  AiConversationSchema,
} from './entities/ai-conversation.entity';
import { RagModule } from '../rag/rag.module';
import { MedicalAnsweringService } from './services/medical-answering.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { LlmGatewayService } from './services/llm-gateway.service';

@Module({
  imports: [
    RagModule,
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    MedicalAnsweringService,
    PromptBuilderService,
    LlmGatewayService,
  ],
})
export class AiAssistantModule {}
