import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
  ChunkingOptions,
  ChunkPayload,
  ChunkMetadata,
  IChunkingService,
} from '../interfaces/chunking.interface';
import { ExtractableFile } from '../interfaces/text-extraction.interface';
import { TextExtractionService } from './text-extraction.service';

@Injectable()
export class ChunkingService implements IChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  constructor(private readonly textExtractionService: TextExtractionService) {}

  async splitFile(
    file: ExtractableFile,
    options: ChunkingOptions = {},
  ): Promise<ChunkPayload[]> {
    const text = await this.textExtractionService.extractText(file);

    return this.splitText(text, {
      ...options,
      fileName: options.fileName ?? file.originalname,
    });
  }

  async splitText(
    text: string,
    options: ChunkingOptions = {},
  ): Promise<ChunkPayload[]> {
    const normalizedText = this.normalizeText(text);
    if (!normalizedText) {
      throw new BadRequestException('Document text is empty');
    }

    const chunkSize = options.chunkSize ?? 1200;
    const chunkOverlap = options.chunkOverlap ?? 200;
    const minChunkSize = options.minChunkSize ?? 160;

    const paragraphs = this.extractParagraphs(normalizedText);
    const chunks = await this.buildHybridChunks(paragraphs, {
      chunkSize,
      chunkOverlap,
      minChunkSize,
      sourceType: options.sourceType,
      fileName: options.fileName,
      metadata: options.metadata,
    });

    this.logger.log(
      `Hybrid chunking completed: ${chunks.length} chunks generated (size=${chunkSize}, overlap=${chunkOverlap})`,
    );

    return chunks;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractParagraphs(text: string): string[] {
    return text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  private isHeading(paragraph: string): boolean {
    const trimmed = paragraph.trim();
    return (
      /^#{1,6}\s+/.test(trimmed) ||
      /^\d+[.)]\s+/.test(trimmed) ||
      /^[A-ZÀ-Ỵ0-9\s\-:,()]{6,}$/.test(trimmed)
    );
  }

  private isBulletList(paragraph: string): boolean {
    return /^([-*•]|\d+[.)])\s+/.test(paragraph.trim());
  }

  private createMetadata(
    base: ChunkMetadata | undefined,
    index: number,
    extra?: Partial<ChunkMetadata>,
  ): ChunkMetadata {
    return {
      ...(base ?? {}),
      ...(extra ?? {}),
      chunkIndex: index,
    };
  }

  private async buildHybridChunks(
    paragraphs: string[],
    options: {
      chunkSize: number;
      chunkOverlap: number;
      minChunkSize: number;
      sourceType?: ChunkMetadata['sourceType'];
      fileName?: string;
      metadata?: ChunkMetadata;
    },
  ): Promise<ChunkPayload[]> {
    const chunks: ChunkPayload[] = [];
    const recursiveSplitter = this.createRecursiveSplitter(
      options.chunkSize,
      options.chunkOverlap,
    );

    let buffer = '';

    const flushBuffer = () => {
      const content = buffer.trim();
      if (!content) {
        buffer = '';
        return;
      }

      chunks.push({
        chunkIndex: chunks.length,
        content,
        metadata: this.createMetadata(options.metadata, chunks.length, {
          sourceType: options.sourceType,
          fileName: options.fileName,
          sectionTitle: this.isHeading(content)
            ? content.slice(0, 120)
            : undefined,
        }),
      });

      buffer = '';
    };

    for (const paragraph of paragraphs) {
      if (!paragraph) {
        continue;
      }

      const normalizedParagraph = paragraph.trim();

      if (normalizedParagraph.length > options.chunkSize) {
        if (buffer.trim()) {
          flushBuffer();
        }

        const fallbackChunks = await this.splitLargeParagraphBySentence(
          normalizedParagraph,
          options.chunkSize,
          options.chunkOverlap,
          recursiveSplitter,
        );

        for (const fallbackChunk of fallbackChunks) {
          const content = fallbackChunk.trim();
          if (!content) {
            continue;
          }

          chunks.push({
            chunkIndex: chunks.length,
            content,
            metadata: this.createMetadata(options.metadata, chunks.length, {
              sourceType: options.sourceType,
              fileName: options.fileName,
            }),
          });
        }

        continue;
      }

      const candidate = buffer
        ? `${buffer}\n\n${normalizedParagraph}`
        : normalizedParagraph;

      const shouldFlushBeforeAdding =
        buffer && candidate.length > options.chunkSize;

      if (shouldFlushBeforeAdding) {
        flushBuffer();
      }

      const mergedCandidate = buffer
        ? `${buffer}\n\n${normalizedParagraph}`
        : normalizedParagraph;

      if (
        mergedCandidate.length >= options.minChunkSize &&
        (this.isHeading(normalizedParagraph) ||
          this.isBulletList(normalizedParagraph))
      ) {
        flushBuffer();
        buffer = normalizedParagraph;
        continue;
      }

      buffer = buffer
        ? `${buffer}\n\n${normalizedParagraph}`
        : normalizedParagraph;

      if (buffer.length >= options.chunkSize) {
        flushBuffer();
      }
    }

    if (buffer.trim()) {
      flushBuffer();
    }

    return chunks.map((chunk, index) => ({
      ...chunk,
      chunkIndex: index,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
      },
    }));
  }

  private createRecursiveSplitter(
    chunkSize: number,
    chunkOverlap: number,
  ): RecursiveCharacterTextSplitter {
    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', '; ', ': ', ' ', ''],
    });
  }

  private async splitLargeParagraphBySentence(
    paragraph: string,
    chunkSize: number,
    chunkOverlap: number,
    recursiveSplitter: RecursiveCharacterTextSplitter,
  ): Promise<string[]> {
    const sentences = this.splitIntoSentences(paragraph);

    if (sentences.length <= 1) {
      const coarseChunks = await recursiveSplitter.splitText(paragraph);
      return coarseChunks.map((part) => part.trim()).filter(Boolean);
    }

    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const normalizedSentence = sentence.trim();
      if (!normalizedSentence) {
        continue;
      }

      if (normalizedSentence.length > chunkSize) {
        if (current.trim()) {
          chunks.push(current.trim());
          current = '';
        }

        const oversizedParts =
          await recursiveSplitter.splitText(normalizedSentence);
        chunks.push(
          ...oversizedParts.map((part) => part.trim()).filter(Boolean),
        );
        continue;
      }

      const candidate = current
        ? `${current} ${normalizedSentence}`
        : normalizedSentence;

      if (candidate.length <= chunkSize) {
        current = candidate;
        continue;
      }

      if (current.trim()) {
        chunks.push(current.trim());
      }

      current = this.createOverlapPrefix(
        chunks[chunks.length - 1],
        normalizedSentence,
        chunkOverlap,
        chunkSize,
      );
    }

    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks;
  }

  private splitIntoSentences(paragraph: string): string[] {
    return paragraph
      .split(/(?<=[.!?…])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }

  private createOverlapPrefix(
    previousChunk: string | undefined,
    sentence: string,
    overlap: number,
    chunkSize: number,
  ): string {
    if (!previousChunk || overlap <= 0) {
      return sentence;
    }

    const overlapPrefix = previousChunk
      .slice(Math.max(0, previousChunk.length - overlap))
      .trim();

    const candidate = overlapPrefix ? `${overlapPrefix} ${sentence}` : sentence;
    return candidate.length <= chunkSize ? candidate : sentence;
  }
}
