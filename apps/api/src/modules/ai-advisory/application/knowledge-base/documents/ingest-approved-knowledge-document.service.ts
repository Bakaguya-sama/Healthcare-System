import { Injectable, Logger } from '@nestjs/common';
import { AiDocumentsService } from './ai-documents.service';
import { RagIngestionService } from '../../retrieval/rag-ingestion.service';

/** Executes only an already approved outbox request. It never makes a document active. */
@Injectable()
export class IngestApprovedKnowledgeDocumentService {
  private readonly logger = new Logger(IngestApprovedKnowledgeDocumentService.name);

  constructor(
    private readonly documents: AiDocumentsService,
    private readonly ingestion: RagIngestionService,
  ) {}

  async ingest(documentId: string): Promise<void> {
    const document = await this.documents.beginIngestion(documentId);
    if (!document) return;
    try {
      const response = await fetch(document.fileUrl);
      if (!response.ok) throw new Error('Knowledge document source is unavailable');
      const buffer = Buffer.from(await response.arrayBuffer());
      await this.ingestion.handleRAG({
        documentId,
        file: { buffer, originalname: document.title, mimetype: document.fileType },
        metadata: {
          contentHash: document.contentHash,
          documentVersion: document.documentVersion,
          language: document.knowledgeLanguage,
          scope: document.scope,
        },
      });
      await this.documents.completeIngestion(documentId);
      this.logger.log({ event: 'knowledge.ingestion.ready_for_activation', documentId });
    } catch (error) {
      await this.documents.markIngestionFailed(documentId);
      this.logger.error({ event: 'knowledge.ingestion.failed', documentId, error: error instanceof Error ? error.name : 'unknown' });
      throw error;
    }
  }
}
