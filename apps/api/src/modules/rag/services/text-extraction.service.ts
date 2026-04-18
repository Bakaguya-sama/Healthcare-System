import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';
import { LlamaCloud, toFile } from '@llamaindex/llama-cloud';
import { extname } from 'node:path';
import {
  ExtractableFile,
  ITextExtractionService,
} from '../interfaces/text-extraction.interface';

@Injectable()
export class TextExtractionService implements ITextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);
  private readonly llamaParseTimeoutMs = 120000;
  private readonly llamaParseApiKey =
    process.env.LLAMA_CLOUD_API_KEY ?? process.env.LLAMAPARSE_API_KEY;

  async extractText(file: ExtractableFile): Promise<string> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File buffer is empty');
    }

    const extension = this.resolveExtension(file.originalname, file.mimetype);
    this.logger.log(
      `Extract start: file=${file.originalname}, ext=${extension || 'unknown'}, size=${file.buffer.length} bytes`,
    );

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
        const text = this.normalizeExtractedText(
          await this.extractWithLlamaParse(file),
        );
        this.logger.log(
          `Extract success: file=${file.originalname}, chars=${text.length}`,
        );
        return text;
      }

      case 'doc': {
        const text = this.normalizeExtractedText(
          await this.extractWithLlamaParse(file),
        );
        this.logger.log(
          `Extract success: file=${file.originalname}, chars=${text.length}`,
        );
        return text;
      }

      case 'pdf': {
        const text = this.normalizeExtractedText(
          await this.extractWithLlamaParse(file),
        );
        this.logger.log(
          `Extract success: file=${file.originalname}, chars=${text.length}`,
        );
        return text;
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
    const preCleaned = repaired
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u0000/g, '');

    const joinedLines = preCleaned.replace(
      /(?<![.!?:;>])\n(?![#\-\—\–\−\•\d*\sA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸ])/g,
      ' ',
    );

    const normalized = this.normalizeMedicalNotation(
      this.cleanAndJoinPDFText(joinedLines),
    )
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => this.sanitizeTextLine(line))
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!normalized) {
      throw new BadRequestException('Cannot extract readable text from file');
    }

    return normalized;
  }

  private async extractWithLlamaParse(file: ExtractableFile): Promise<string> {
    if (!this.llamaParseApiKey) {
      throw new BadRequestException(
        'Missing LLAMA_CLOUD_API_KEY (or LLAMAPARSE_API_KEY) for document parsing',
      );
    }

    this.logger.log(
      `LlamaParse request started: file=${file.originalname}, timeout=${this.llamaParseTimeoutMs}ms`,
    );

    const client = new LlamaCloud({ apiKey: this.llamaParseApiKey });

    try {
      const parsed = await this.withTimeout(
        client.parsing.parse({
          tier: 'cost_effective',
          version: 'latest',
          upload_file: await toFile(
            new Uint8Array(file.buffer),
            file.originalname,
          ),
          expand: ['markdown', 'text'],
          processing_options: {
            ocr_parameters: {
              languages: ['vi'],
            },
          },
        }),
        this.llamaParseTimeoutMs,
        `LlamaParse timed out after ${this.llamaParseTimeoutMs}ms for ${file.originalname}`,
      );

      const extractedText = this.extractReadableContent(parsed);

      if (!extractedText.trim()) {
        const status =
          this.tryGetString(parsed, ['job', 'status']) ?? 'unknown';
        const errorMessage =
          this.tryGetString(parsed, ['job', 'error_message']) ?? 'none';
        throw new BadRequestException(
          `LlamaParse cannot extract readable content from ${file.originalname} (status=${status}, error=${errorMessage})`,
        );
      }

      const parseJobId = this.tryGetString(parsed, ['job', 'id']) ?? 'unknown';
      this.logger.log(
        `LlamaParse response received: file=${file.originalname}, jobId=${parseJobId}, chars=${extractedText.length}`,
      );

      return extractedText;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `LlamaParse failed for ${file.originalname}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private extractReadableContent(parsed: unknown): string {
    const markdownFull = this.tryGetString(parsed, ['markdown_full']) ?? '';
    const textFull = this.tryGetString(parsed, ['text_full']) ?? '';

    const markdownPages = this.joinStringArray(
      this.tryGetArray(parsed, ['markdown', 'pages'])
        .filter((page) => this.tryGetBoolean(page, ['success']) !== false)
        .map((page) => this.tryGetString(page, ['markdown']) ?? ''),
    );

    const textPages = this.joinStringArray(
      this.tryGetArray(parsed, ['text', 'pages']).map(
        (page) => this.tryGetString(page, ['text']) ?? '',
      ),
    );

    const candidates = [markdownFull, markdownPages, textFull, textPages].map(
      (value) => value.trim(),
    );

    const best = candidates.reduce((prev, current) =>
      current.length > prev.length ? current : prev,
    );

    this.logger.log(
      `LlamaParse content candidates: markdown_full=${markdownFull.length}, markdown_pages=${markdownPages.length}, text_full=${textFull.length}, text_pages=${textPages.length}`,
    );

    return best;
  }

  private tryGetString(obj: unknown, path: string[]): string | undefined {
    const value = this.tryGet(obj, path);
    return typeof value === 'string' ? value : undefined;
  }

  private tryGetBoolean(obj: unknown, path: string[]): boolean | undefined {
    const value = this.tryGet(obj, path);
    return typeof value === 'boolean' ? value : undefined;
  }

  private tryGetArray(obj: unknown, path: string[]): unknown[] {
    const value = this.tryGet(obj, path);
    return Array.isArray(value) ? value : [];
  }

  private tryGet(obj: unknown, path: string[]): unknown {
    let cursor: unknown = obj;

    for (const key of path) {
      if (!cursor || typeof cursor !== 'object') {
        return undefined;
      }

      const record = cursor as Record<string, unknown>;
      cursor = record[key];
    }

    return cursor;
  }

  private joinStringArray(values: string[]): string {
    return values
      .map((value) => value.trim())
      .filter(Boolean)
      .join('\n\n');
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new BadRequestException(timeoutMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private cleanAndJoinPDFText(text: string): string {
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim, '');

    const lines = normalized.split('\n');
    const output: string[] = [];
    let paragraphBuffer = '';

    const flushParagraph = (): void => {
      const paragraph = paragraphBuffer.trim().replace(/\s{2,}/g, ' ');
      paragraphBuffer = '';

      if (!paragraph) {
        return;
      }

      output.push(paragraph);
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        if (output.at(-1) !== '') {
          output.push('');
        }
        continue;
      }

      if (this.isMarkdownStructuralLine(line)) {
        flushParagraph();
        output.push(line);
        continue;
      }

      if (!paragraphBuffer) {
        paragraphBuffer = line;
        continue;
      }

      paragraphBuffer += /[.!?:…]$/.test(paragraphBuffer)
        ? `\n${line}`
        : ` ${line}`;
    }

    flushParagraph();

    return output
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private isMarkdownStructuralLine(line: string): boolean {
    return (
      /^#{1,6}\s+/.test(line) ||
      /^([-*+]\s+|\d+[.)]\s+)/.test(line) ||
      /^\|.*\|$/.test(line)
    );
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

  private sanitizeTextLine(line: string): string {
    return line
      .split('')
      .map((char) => this.sanitizeControlChar(char))
      .join('')
      .replace(/[ \t]+$/g, '');
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
