import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingService } from '../interfaces/embedding.interface';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_BATCH_SIZE = 64;
const MAX_BATCH_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 8000;
const MAX_FALLBACK_ATTEMPTS = 5;
const FALLBACK_MIN_INTERVAL_MS = 1200;

@Injectable()
export class EmbeddingService implements IEmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private embeddings: GoogleGenerativeAIEmbeddings | null = null;
  private genAI: GoogleGenerativeAI | null = null;
  private langChainDocumentEmbeddingDisabled = false;
  private fallbackModeLogged = false;
  private lastFallbackRequestAt = 0;

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

    if (this.langChainDocumentEmbeddingDisabled) {
      if (!this.fallbackModeLogged) {
        this.logger.warn(
          'LangChain document embeddings disabled due to invalid vector output. Using Gemini embedContent fallback for document embeddings.',
        );
        this.fallbackModeLogged = true;
      }

      return this.generateEmbeddingsFallback(sanitizedTexts);
    }

    const client = this.getClient();
    const batches = this.chunkTexts(sanitizedTexts, EMBEDDING_BATCH_SIZE);
    const allVectors: number[][] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        const batchVectors = await this.embedBatchWithRetry(
          client,
          batch,
          batchIndex,
          batches.length,
        );
        const normalizedBatchVectors = batchVectors.map((vector) =>
          this.normalizeEmbeddingVector(vector),
        );

        const invalidVectorIndex = normalizedBatchVectors.findIndex(
          (vector) => vector === null,
        );

        if (invalidVectorIndex !== -1 || batchVectors.length !== batch.length) {
          const invalidShape =
            invalidVectorIndex !== -1
              ? this.describeVectorShape(batchVectors[invalidVectorIndex])
              : 'unknown';

          this.logger.warn(
            `LangChain embedding invalid for batch ${batchIndex + 1}/${batches.length} (invalidIndex=${invalidVectorIndex}, total=${batchVectors.length}, shape=${invalidShape}). Repairing invalid vectors via Gemini embedContent fallback.`,
          );

          if (invalidVectorIndex === 0) {
            this.langChainDocumentEmbeddingDisabled = true;
          }

          const repairedVectors = await this.repairInvalidBatchVectors(
            batch,
            batchVectors,
          );
          allVectors.push(...repairedVectors);
          continue;
        }

        allVectors.push(...(normalizedBatchVectors as number[][]));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown embedding error';

        if (this.isRateLimitError(error)) {
          throw new HttpException(
            `Embedding quota exceeded while processing batch ${batchIndex + 1}/${batches.length}. Please retry later. Details: ${message}`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        this.logger.warn(
          `LangChain embedding failed for batch ${batchIndex + 1}/${batches.length}: ${message}. Falling back to Gemini embedContent for this batch.`,
        );

        const fallbackVectors = await this.generateEmbeddingsFallback(batch);
        allVectors.push(...fallbackVectors);
      }
    }

    if (allVectors.length !== sanitizedTexts.length) {
      throw new BadRequestException(
        `Embedding output count mismatch: expected=${sanitizedTexts.length}, actual=${allVectors.length}`,
      );
    }

    return allVectors;
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    const normalizedQuery = query?.trim();
    if (!normalizedQuery) {
      throw new BadRequestException('Query is required for embedding');
    }

    const client = this.getClient();
    const vector = await client.embedQuery(normalizedQuery);
    const normalizedVector = this.normalizeEmbeddingVector(vector);

    if (normalizedVector) {
      return normalizedVector;
    }

    this.logger.warn(
      'LangChain query embedding is invalid. Falling back to direct Gemini embedContent.',
    );

    const [fallback] = await this.generateEmbeddingsFallback([normalizedQuery]);
    return fallback;
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

  private getGenAIClient(): GoogleGenerativeAI {
    if (this.genAI) {
      return this.genAI;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'dev_key_placeholder') {
      throw new BadRequestException(
        'GEMINI_API_KEY is not configured for embedding service',
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    return this.genAI;
  }

  private async generateEmbeddingsFallback(
    texts: string[],
  ): Promise<number[][]> {
    const embeddingModel = this.getGenAIClient().getGenerativeModel({
      model: EMBEDDING_MODEL,
    });

    const fallbackVectors: number[][] = [];

    for (let index = 0; index < texts.length; index++) {
      const text = texts[index];
      const values = await this.embedSingleWithRetry(
        embeddingModel,
        text,
        `fallback ${index + 1}/${texts.length}`,
      );
      const normalizedVector = this.normalizeEmbeddingVector(values);

      if (!normalizedVector) {
        throw new BadRequestException(
          'Gemini fallback returned invalid embedding vector',
        );
      }

      fallbackVectors.push(normalizedVector);
    }

    return fallbackVectors;
  }

  private async embedSingleWithRetry(
    embeddingModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
    text: string,
    context: string,
  ): Promise<unknown> {
    for (let attempt = 1; attempt <= MAX_FALLBACK_ATTEMPTS; attempt++) {
      try {
        await this.waitBeforeFallbackRequest();
        const response = await embeddingModel.embedContent(text);
        return response.embedding?.values;
      } catch (error) {
        if (
          !this.isRateLimitError(error) ||
          attempt === MAX_FALLBACK_ATTEMPTS
        ) {
          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error) + attempt * 300;
        this.logger.warn(
          `Rate limit on ${context}, attempt ${attempt}/${MAX_FALLBACK_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'Embedding fallback retry attempts exceeded',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async waitBeforeFallbackRequest(): Promise<void> {
    const elapsed = Date.now() - this.lastFallbackRequestAt;
    const waitMs = FALLBACK_MIN_INTERVAL_MS - elapsed;
    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
    this.lastFallbackRequestAt = Date.now();
  }

  private chunkTexts(texts: string[], batchSize: number): string[][] {
    const chunks: string[][] = [];

    for (let index = 0; index < texts.length; index += batchSize) {
      chunks.push(texts.slice(index, index + batchSize));
    }

    return chunks;
  }

  private async embedBatchWithRetry(
    client: GoogleGenerativeAIEmbeddings,
    texts: string[],
    batchIndex: number,
    totalBatches: number,
  ): Promise<unknown[]> {
    for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt++) {
      try {
        return await client.embedDocuments(texts);
      } catch (error) {
        if (!this.isRateLimitError(error) || attempt === MAX_BATCH_ATTEMPTS) {
          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error);
        this.logger.warn(
          `Rate limit on batch ${batchIndex + 1}/${totalBatches}, attempt ${attempt}/${MAX_BATCH_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );

        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'Embedding retry attempts exceeded',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private isRateLimitError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();
    return (
      message.includes('429') ||
      lowerMessage.includes('quota') ||
      lowerMessage.includes('resource exhausted') ||
      lowerMessage.includes('too many requests')
    );
  }

  private extractRetryDelayMs(error: unknown): number {
    const message = error instanceof Error ? error.message : String(error);

    const secondsMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (secondsMatch) {
      return Math.ceil(Number(secondsMatch[1]) * 1000);
    }

    const millisMatch = message.match(/retry in\s+(\d+)ms/i);
    if (millisMatch) {
      return Number(millisMatch[1]);
    }

    return DEFAULT_RETRY_DELAY_MS;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isValidEmbeddingVector(vector: unknown): vector is number[] {
    return this.normalizeEmbeddingVector(vector) !== null;
  }

  private normalizeEmbeddingVector(vector: unknown): number[] | null {
    if (Array.isArray(vector)) {
      return this.normalizeNumberArray(vector);
    }

    if (ArrayBuffer.isView(vector)) {
      return this.normalizeNumberArray(
        Array.from(vector as unknown as ArrayLike<unknown>),
      );
    }

    if (typeof vector === 'object' && vector !== null && 'values' in vector) {
      const values = (vector as { values?: unknown }).values;
      if (Array.isArray(values)) {
        return this.normalizeNumberArray(values);
      }

      if (ArrayBuffer.isView(values)) {
        return this.normalizeNumberArray(
          Array.from(values as unknown as ArrayLike<unknown>),
        );
      }
    }

    if (
      typeof vector === 'object' &&
      vector !== null &&
      'embedding' in vector
    ) {
      const embedding = (vector as { embedding?: unknown }).embedding;
      if (
        typeof embedding === 'object' &&
        embedding !== null &&
        'values' in embedding
      ) {
        const values = (embedding as { values?: unknown }).values;

        if (Array.isArray(values)) {
          return this.normalizeNumberArray(values);
        }

        if (ArrayBuffer.isView(values)) {
          return this.normalizeNumberArray(
            Array.from(values as unknown as ArrayLike<unknown>),
          );
        }
      }
    }

    if (typeof vector === 'object' && vector !== null && 'vector' in vector) {
      const values = (vector as { vector?: unknown }).vector;
      if (Array.isArray(values)) {
        return this.normalizeNumberArray(values);
      }

      if (ArrayBuffer.isView(values)) {
        return this.normalizeNumberArray(
          Array.from(values as unknown as ArrayLike<unknown>),
        );
      }
    }

    return null;
  }

  private describeVectorShape(vector: unknown): string {
    if (Array.isArray(vector)) {
      return 'array';
    }

    if (ArrayBuffer.isView(vector)) {
      return 'typed-array';
    }

    if (vector && typeof vector === 'object') {
      return `object:${Object.keys(vector as Record<string, unknown>).join(',')}`;
    }

    return typeof vector;
  }

  private async repairInvalidBatchVectors(
    texts: string[],
    vectors: unknown[],
  ): Promise<number[][]> {
    const repaired: number[][] = [];

    for (let index = 0; index < texts.length; index++) {
      const normalizedVector = this.normalizeEmbeddingVector(vectors[index]);
      if (normalizedVector) {
        repaired.push(normalizedVector);
        continue;
      }

      const [fallbackVector] = await this.generateEmbeddingsFallback([
        texts[index],
      ]);
      repaired.push(fallbackVector);
    }

    return repaired;
  }

  private normalizeNumberArray(values: unknown[]): number[] | null {
    const normalized = values.map((value) => Number(value));

    if (
      normalized.length === 0 ||
      normalized.some((value) => Number.isNaN(value) || !Number.isFinite(value))
    ) {
      return null;
    }

    return normalized;
  }
}
