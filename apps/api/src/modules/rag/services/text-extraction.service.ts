import { BadRequestException, Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { extname } from 'node:path';
import WordExtractor from 'word-extractor';
import {
  ExtractableFile,
  ITextExtractionService,
} from '../interfaces/text-extraction.interface';

@Injectable()
export class TextExtractionService implements ITextExtractionService {
  async extractText(file: ExtractableFile): Promise<string> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    const extension = this.resolveExtension(file.originalname, file.mimetype);

    switch (extension) {
      case 'txt':
      case 'md':
      case 'csv':
      case 'json':
      case 'xml':
      case 'html':
      case 'htm': {
        return this.normalizeExtractedText(file.buffer.toString('utf-8'));
      }

      case 'docx': {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return this.normalizeExtractedText(result.value);
      }

      case 'doc': {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(file.buffer);
        return this.normalizeExtractedText(extracted.getBody());
      }

      case 'pdf': {
        const pdfParseModule = await import('pdf-parse');
        const parsed = await pdfParseModule.default(file.buffer);
        return this.normalizeExtractedText(parsed.text);
      }

      default:
        throw new BadRequestException(
          `Unsupported file type: ${extension || 'unknown'}. Supported: txt, doc, docx, pdf`,
        );
    }
  }

  private resolveExtension(fileName: string, mimeType?: string): string {
    const ext = extname(fileName || '')
      .replace('.', '')
      .toLowerCase();

    if (ext) {
      return ext;
    }

    if (!mimeType) {
      return '';
    }

    if (mimeType.includes('pdf')) {
      return 'pdf';
    }

    if (
      mimeType.includes(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
    ) {
      return 'docx';
    }

    if (mimeType.includes('msword')) {
      return 'doc';
    }

    if (mimeType.includes('text/plain')) {
      return 'txt';
    }

    return '';
  }

  private normalizeExtractedText(text: string): string {
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      throw new BadRequestException('Cannot extract readable text from file');
    }

    return normalized;
  }
}
