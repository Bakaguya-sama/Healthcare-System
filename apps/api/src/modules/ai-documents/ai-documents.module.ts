import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiDocumentsService } from './ai-documents.service';
import { AiDocumentsController } from './ai-documents.controller';
import { AiDocument, AiDocumentSchema } from './entities/ai-document.entity';
import { CloudinaryService } from '../../core/services/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiDocument.name, schema: AiDocumentSchema },
    ]),
  ],
  controllers: [AiDocumentsController],
  providers: [AiDocumentsService, CloudinaryService],
  exports: [AiDocumentsService],
})
export class AiDocumentsModule {}
