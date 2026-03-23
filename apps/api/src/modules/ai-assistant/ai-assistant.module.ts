import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantController } from './ai-assistant.controller';
import {
  AiConversation,
  AiConversationSchema,
} from './entities/ai-conversation.entity';
import {
  AiDocumentChunk,
  AiDocumentChunkSchema,
} from '../ai-document-chunks/entities/ai-document-chunk.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiDocumentChunk.name, schema: AiDocumentChunkSchema },
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
