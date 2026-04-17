import { BadRequestException, Injectable } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';
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
        return this.normalizeExtractedText(this.decodeTextBuffer(file.buffer));
      }

      case 'docx': {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return this.normalizeExtractedText(result.value);
      }

      case 'doc': {
        const extractor = new (WordExtractor as unknown as {
          new (): {
            extract(input: Buffer): Promise<{ getBody(): string }>;
          };
        })();
        const extracted = await extractor.extract(file.buffer);
        return this.normalizeExtractedText(extracted.getBody());
      }

      case 'pdf': {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: file.buffer });

        try {
          const parsed = await parser.getText();
          return this.normalizeExtractedText(parsed.text);
        } finally {
          await parser.destroy().catch(() => undefined);
        }
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
    const repaired = this.repairEncodingArtifacts(text);
    const normalized = this.normalizeMedicalNotation(repaired)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('')
      .map((char) => this.sanitizeControlChar(char))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      throw new BadRequestException('Cannot extract readable text from file');
    }

    return normalized;
  }

  private repairEncodingArtifacts(text: string): string {
    const hasMojibakeHints = /[ÃÂÆÐÑÕÖØÙÚÛÜÝÞß¬ÊËÏ]|á»|Ä|Æ/.test(text);
    if (!hasMojibakeHints) {
      return text;
    }

    const candidates = [
      text,
      this.redecodeViaCodePage(text, 'latin1'),
      this.redecodeViaCodePage(text, 'windows-1252'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    const bestCandidate = candidates.reduce((best, current) => {
      return this.calculateTextPenalty(current) <
        this.calculateTextPenalty(best)
        ? current
        : best;
    });

    return bestCandidate;
  }

  private redecodeViaCodePage(text: string, encoding: string): string {
    try {
      const bytes = iconv.encode(text, encoding);
      return iconv.decode(bytes, 'utf8');
    } catch {
      return text;
    }
  }

  private normalizeMedicalNotation(text: string): string {
    return text
      .replace(/\b([3-4]\d(?:[.,]\d+)?)\s*0\s*[cC]\b/g, '$1°C')
      .replace(/\b([3-4]\d(?:[.,]\d+)?)0\s*[cC]\b/g, '$1°C')
      .replace(/\b([3-4]\d(?:[.,]\d+)?)\s*[oº]\s*[cC]\b/g, '$1°C');
  }

  private decodeTextBuffer(buffer: Buffer): string {
    const utf8Text = buffer.toString('utf8');
    const detectedEncoding = this.detectEncoding(buffer);

    const candidateEncodings = this.buildCandidateEncodings(detectedEncoding);
    const candidates = candidateEncodings.map((encoding) => ({
      encoding,
      text: iconv.decode(buffer, encoding),
    }));

    const bestCandidate = candidates.reduce((best, current) => {
      return this.calculateTextPenalty(current.text) <
        this.calculateTextPenalty(best.text)
        ? current
        : best;
    });

    const utf8Penalty = this.calculateTextPenalty(utf8Text);
    const bestPenalty = this.calculateTextPenalty(bestCandidate.text);

    if (utf8Penalty <= bestPenalty + 1) {
      return utf8Text;
    }

    return bestCandidate.text;
  }

  private detectEncoding(buffer: Buffer): string | undefined {
    const detection = jschardet.detect(buffer);
    const rawEncoding = detection.encoding?.toLowerCase();

    if (!rawEncoding || detection.confidence < 0.45) {
      return undefined;
    }

    return this.normalizeEncoding(rawEncoding);
  }

  private buildCandidateEncodings(detected?: string): string[] {
    const preferred = ['utf8', 'windows-1258', 'windows-1252', 'latin1'];
    const merged = detected ? [detected, ...preferred] : preferred;

    return Array.from(new Set(merged)).filter((encoding) =>
      iconv.encodingExists(encoding),
    );
  }

  private normalizeEncoding(encoding: string): string {
    switch (encoding) {
      case 'utf-8':
      case 'utf8':
        return 'utf8';
      case 'windows-1258':
      case 'cp1258':
        return 'windows-1258';
      case 'windows-1252':
      case 'cp1252':
        return 'windows-1252';
      case 'iso-8859-1':
      case 'latin1':
        return 'latin1';
      default:
        return encoding;
    }
  }

  private calculateTextPenalty(text: string): number {
    const replacementChars = (text.match(/�/g) || []).length;
    const mojibakeHints = (text.match(/[ÃÂÆÐÑÕÖØÙÚÛÜÝÞß¬ÊËÏ]/g) || []).length;
    const vietnameseChars = (
      text.match(/[ăâđêôơưĂÂĐÊÔƠƯàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/g) || []
    ).length;

    return replacementChars * 10 + mojibakeHints * 2 - vietnameseChars * 0.2;
  }

  private sanitizeControlChar(char: string): string {
    const code = char.charCodeAt(0);
    if (
      (code >= 0 && code <= 31 && code !== 9 && code !== 10) ||
      code === 127
    ) {
      return ' ';
    }

    return char;
  }
}
