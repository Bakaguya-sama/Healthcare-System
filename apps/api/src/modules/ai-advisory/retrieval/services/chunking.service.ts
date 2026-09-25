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

    const sections = this.splitByMarkdownHeaders(normalizedText);
    const recursiveSplitter = this.createRecursiveSplitter(
      chunkSize,
      chunkOverlap,
    );
    const chunks = await this.buildMarkdownAwareChunks(sections, {
      chunkSize,
      chunkOverlap,
      minChunkSize,
      recursiveSplitter,
      sourceType: options.sourceType,
      fileName: options.fileName,
      metadata: options.metadata,
    });

    this.logger.log(
      `Hybrid chunking completed: ${chunks.length} chunks generated (size=${chunkSize}, overlap=${chunkOverlap})`,
    );

    return chunks;
  }

  private splitByMarkdownHeaders(
    text: string,
  ): Array<{ pageContent: string; metadata?: Record<string, unknown> }> {
    try {
      return this.splitMarkdownSections(text);
    } catch (error) {
      this.logger.warn(
        `Markdown header splitting failed, falling back to plain text chunking: ${String(error)}`,
      );

      return [{ pageContent: text, metadata: undefined }];
    }
  }

  private splitMarkdownSections(
    text: string,
  ): Array<{ pageContent: string; metadata?: Record<string, unknown> }> {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const sections: Array<{
      pageContent: string;
      metadata?: Record<string, unknown>;
    }> = [];
    let currentLines: string[] = [];
    let currentMetadata: Record<string, unknown> = {};

    const flushSection = (): void => {
      const content = currentLines.join('\n').trim();
      currentLines = [];

      if (!content) {
        return;
      }

      sections.push({
        pageContent: content,
        metadata:
          Object.keys(currentMetadata).length > 0
            ? { ...currentMetadata }
            : undefined,
      });
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);

      if (headerMatch) {
        flushSection();

        const headerLevel = headerMatch[1].length;
        const headerText = headerMatch[2].trim();
        currentMetadata = {
          ...currentMetadata,
          [`h${headerLevel}`]: headerText,
        };
        currentLines.push(`${headerMatch[1]} ${headerText}`);
        continue;
      }

      if (line.trim() === '') {
        currentLines.push('');
        continue;
      }

      currentLines.push(line);
    }

    flushSection();

    return sections.length > 0
      ? sections
      : [{ pageContent: text, metadata: undefined }];
  }

  private async buildMarkdownAwareChunks(
    sections: Array<{
      pageContent: string;
      metadata?: Record<string, unknown>;
    }>,
    options: {
      chunkSize: number;
      chunkOverlap: number;
      minChunkSize: number;
      recursiveSplitter: RecursiveCharacterTextSplitter;
      sourceType?: ChunkMetadata['sourceType'];
      fileName?: string;
      metadata?: ChunkMetadata;
    },
  ): Promise<ChunkPayload[]> {
    const chunks: ChunkPayload[] = [];

    for (const section of sections) {
      const sectionText = this.normalizeText(section.pageContent);
      if (!sectionText) {
        continue;
      }

      const sectionMetadata = this.mergeMetadata(options.metadata, {
        ...(section.metadata ?? {}),
        sourceType: options.sourceType,
        fileName: options.fileName,
        sectionTitle: this.extractSectionTitle(section.metadata),
      });

      if (sectionText.length <= options.chunkSize) {
        chunks.push({
          chunkIndex: chunks.length,
          content: sectionText,
          metadata: this.createMetadata(sectionMetadata, chunks.length),
        });
        continue;
      }

      const recursiveChunks = await this.recursiveSplitSection(
        sectionText,
        options.recursiveSplitter,
      );

      const mergedChunks = this.mergeShortChunks(
        recursiveChunks,
        options.minChunkSize,
        options.chunkSize,
      );

      for (const content of mergedChunks) {
        const normalizedContent = this.normalizeText(content);
        if (!normalizedContent) {
          continue;
        }

        chunks.push({
          chunkIndex: chunks.length,
          content: normalizedContent,
          metadata: this.createMetadata(sectionMetadata, chunks.length),
        });
      }
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

  private mergeMetadata(
    base: ChunkMetadata | undefined,
    extra?: Partial<ChunkMetadata>,
  ): ChunkMetadata {
    return {
      ...(base ?? {}),
      ...(extra ?? {}),
    };
  }

  private extractSectionTitle(
    metadata: Record<string, unknown> | undefined,
  ): string | undefined {
    if (!metadata) {
      return undefined;
    }

    const preferredKeys = [
      'h4',
      'h3',
      'h2',
      'h1',
      'Header 4',
      'Header 3',
      'Header 2',
      'Header 1',
    ];

    for (const key of preferredKeys) {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }

  private async recursiveSplitSection(
    text: string,
    recursiveSplitter: RecursiveCharacterTextSplitter,
  ): Promise<string[]> {
    const parts = await recursiveSplitter.splitText(text);
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  private mergeShortChunks(
    chunks: string[],
    minChunkSize: number,
    targetChunkSize: number,
  ): string[] {
    const normalizedChunks = chunks
      .map((chunk) => this.normalizeText(chunk))
      .filter(Boolean);

    if (normalizedChunks.length <= 1) {
      return normalizedChunks;
    }

    const merged: string[] = [normalizedChunks[0]];

    const absoluteMaxSize = targetChunkSize * 1.2;

    for (let i = 1; i < normalizedChunks.length; i++) {
      const chunk = normalizedChunks[i];
      const lastIndex = merged.length - 1;
      const lastChunk = merged[lastIndex];

      const currentIsShort = chunk.length < minChunkSize;
      const lastIsShort = lastChunk.length < minChunkSize;

      const canMergeSize =
        lastChunk.length + chunk.length + 1 <= absoluteMaxSize;

      if ((currentIsShort || lastIsShort) && canMergeSize) {
        merged[lastIndex] = this.normalizeText(`${lastChunk}\n${chunk}`);
        continue;
      }

      merged.push(chunk);
    }

    if (merged.length > 1) {
      const tailIndex = merged.length - 1;
      const tail = merged[tailIndex];
      const prevChunk = merged[tailIndex - 1];

      if (
        tail.length < minChunkSize &&
        prevChunk.length + tail.length + 1 <= absoluteMaxSize
      ) {
        merged[tailIndex - 1] = this.normalizeText(`${prevChunk}\n${tail}`);
        merged.pop();
      }
    }

    return merged;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

  private createRecursiveSplitter(
    chunkSize: number,
    chunkOverlap: number,
  ): RecursiveCharacterTextSplitter {
    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: [
        '\n## ',
        '\n### ',
        '\n#### ',
        '\n\n',
        '\n',
        '. ',
        '? ',
        '! ',
        ', ',
        ' ',
        '',
      ],
    });
  }
}
