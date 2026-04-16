import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiDocumentsService } from './ai-documents.service';
import { AiDocumentsController } from './ai-documents.controller';
import { AiDocument, AiDocumentSchema } from './entities/ai-document.entity';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import {
  AiDocumentChunk,
  AiDocumentChunkDocument,
  AiDocumentChunkSchema,
} from '../ai-document-chunks/entities/ai-document-chunk.entity';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiDocument.name, schema: AiDocumentSchema },
      { name: AiDocumentChunk.name, schema: AiDocumentChunkSchema },
    ]),
  ],
  controllers: [AiDocumentsController],
  providers: [AiDocumentsService, CloudinaryService],
  exports: [AiDocumentsService],
})
export class AiDocumentsModule {}
