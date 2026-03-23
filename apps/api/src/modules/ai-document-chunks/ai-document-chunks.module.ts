import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiDocumentChunksService } from './ai-document-chunks.service';
import { AiDocumentChunksController } from './ai-document-chunks.controller';
import {
  AiConversation,
  AiConversationSchema,
} from '../ai-assistant/entities/ai-conversation.entity';
import {
  AiDocumentChunk,
  AiDocumentChunkSchema,
} from './entities/ai-document-chunk.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiDocumentChunk.name, schema: AiDocumentChunkSchema },
    ]),
  ],
  controllers: [AiDocumentChunksController],
  providers: [AiDocumentChunksService],
  exports: [AiDocumentChunksService],
})
export class AiDocumentChunksModule {}
