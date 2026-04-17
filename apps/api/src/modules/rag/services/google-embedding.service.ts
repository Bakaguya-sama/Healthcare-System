import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingService } from '../interfaces/embedding.interface';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

const EMBEDDING_MODEL = 'gemini-embedding-001';

@Injectable()
export class EmbeddingService implements IEmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private embeddings: GoogleGenerativeAIEmbeddings | null = null;

  constructor(private readonly configService: ConfigService) {}

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new BadRequestException('Texts are required for embedding');
    }

    const sanitizedTexts = texts
      .map((text) => text?.trim())
      .filter((text): text is string => Boolean(text));

    if (sanitizedTexts.length === 0) {
      throw new BadRequestException('Texts are empty after normalization');
    }

    const client = this.getClient();
    return client.embedDocuments(sanitizedTexts);
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    const normalizedQuery = query?.trim();
    if (!normalizedQuery) {
      throw new BadRequestException('Query is required for embedding');
    }

    const client = this.getClient();
    return client.embedQuery(normalizedQuery);
  }

  private getClient(): GoogleGenerativeAIEmbeddings {
    if (this.embeddings) {
      return this.embeddings;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'dev_key_placeholder') {
      throw new BadRequestException(
        'GEMINI_API_KEY is not configured for embedding service',
      );
    }

    try {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        modelName: EMBEDDING_MODEL,
      });
      this.logger.log(`Embedding client initialized with ${EMBEDDING_MODEL}`);
      return this.embeddings;
    } catch (error) {
      this.logger.error('Failed to initialize Google embedding client', error);
      throw new BadRequestException('Failed to initialize embedding service');
    }
  }
}
