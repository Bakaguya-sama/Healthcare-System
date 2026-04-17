import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { ChunkingService } from '../modules/rag/services/chunking.service';
import { TextExtractionService } from '../modules/rag/services/text-extraction.service';

type ChunkRecord = { content?: unknown };

type CliArgs = {
  filePath?: string;
  responsePath?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === '--file' && next) {
      args.filePath = next;
      i++;
      continue;
    }

    if (current === '--response' && next) {
      args.responsePath = next;
      i++;
      continue;
    }

    if (current === '--chunkSize' && next) {
      args.chunkSize = Number(next);
      i++;
      continue;
    }

    if (current === '--chunkOverlap' && next) {
      args.chunkOverlap = Number(next);
      i++;
      continue;
    }

    if (current === '--minChunkSize' && next) {
      args.minChunkSize = Number(next);
      i++;
      continue;
    }
  }

  return args;
}

function usage(): never {
  throw new Error(
    'Usage: pnpm ts-node -r tsconfig-paths/register src/scripts/rag-integrity-check.ts --file <path-to-original-file> [--response <path-to-response.json>] [--chunkSize 1200 --chunkOverlap 200 --minChunkSize 160]',
  );
}

function extractChunksFromResponse(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;

  const data =
    typeof parsed === 'object' &&
    parsed !== null &&
    'data' in parsed &&
    Array.isArray((parsed as { data?: unknown }).data)
      ? ((parsed as { data: ChunkRecord[] }).data ?? [])
      : Array.isArray(parsed)
        ? (parsed as ChunkRecord[])
        : [];

  return data
    .map((item) => (typeof item.content === 'string' ? item.content : ''))
    .filter(Boolean);
}

function normalizeForCompare(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 4);
}

function tokenize(text: string): string[] {
  const matches = text
    .toLowerCase()
    .match(
      /[a-z0-9àáạảãăắằẳẵặâấầẩẫậđèéẹẻẽêếềểễệìíịỉĩòóọỏõôốồổỗộơớờởỡợùúụủũưứừửữựỳýỵỷỹ]+/gi,
    );

  return matches ?? [];
}

function toFreqMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function topMissingTokens(
  source: Map<string, number>,
  target: Map<string, number>,
  limit = 12,
): Array<{ token: string; missing: number }> {
  const rows: Array<{ token: string; missing: number }> = [];

  for (const [token, sourceCount] of source.entries()) {
    const targetCount = target.get(token) ?? 0;
    if (sourceCount > targetCount) {
      rows.push({ token, missing: sourceCount - targetCount });
    }
  }

  return rows.sort((a, b) => b.missing - a.missing).slice(0, limit);
}

function countRegex(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function detectMojibakeCount(text: string): number {
  return countRegex(text, /[ÃÂÆÐÑÕÖØÙÚÛÜÝÞß¬ÊËÏ]|á»|Ä|Æ/g);
}

function detectBrokenDegreeCount(text: string): number {
  return countRegex(text, /\b([3-4]\d(?:[.,]\d+)?)\s*0\s*[cC]\b/g);
}

function detectDegreeCount(text: string): number {
  return countRegex(text, /°C/g);
}

function printTitle(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.filePath && !args.responsePath) {
    usage();
  }

  const extractionService = new TextExtractionService();
  const chunkingService = new ChunkingService(extractionService);

  let extractedText = '';
  let chunkTexts: string[] = [];

  if (args.filePath) {
    const fileBuffer = readFileSync(args.filePath);
    const fileName = basename(args.filePath);
    const extension = extname(fileName).replace('.', '').toLowerCase();
    const mimetype =
      extension === 'pdf'
        ? 'application/pdf'
        : extension === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : extension === 'doc'
            ? 'application/msword'
            : 'text/plain';

    extractedText = await extractionService.extractText({
      originalname: fileName,
      mimetype,
      buffer: fileBuffer,
    });

    if (!args.responsePath) {
      const chunks = await chunkingService.splitText(extractedText, {
        chunkSize: args.chunkSize,
        chunkOverlap: args.chunkOverlap,
        minChunkSize: args.minChunkSize,
        fileName,
      });
      chunkTexts = chunks.map((chunk) => chunk.content);
    }
  }

  if (args.responsePath) {
    const responseRaw = readFileSync(args.responsePath, 'utf8');
    chunkTexts = extractChunksFromResponse(responseRaw);
  }

  const chunkCorpus = normalizeForCompare(chunkTexts.join('\n'));

  printTitle('Input Summary');
  console.log(`chunks: ${chunkTexts.length}`);
  console.log(`chunk corpus chars: ${chunkCorpus.length}`);

  printTitle('Corruption Signals');
  const chunkMojibake = detectMojibakeCount(chunkCorpus);
  const chunkBrokenDegree = detectBrokenDegreeCount(chunkCorpus);
  const chunkDegree = detectDegreeCount(chunkCorpus);
  console.log(`mojibake markers in chunks: ${chunkMojibake}`);
  console.log(`broken degree patterns (e.g. 380C): ${chunkBrokenDegree}`);
  console.log(`valid degree symbols (°C): ${chunkDegree}`);

  if (!extractedText) {
    printTitle('Result');
    console.log(
      'Response-only mode: detected corruption signals above. Provide --file to run full integrity coverage check.',
    );
    return;
  }

  const normalizedExtracted = normalizeForCompare(extractedText);
  const sourceSentences = splitSentences(normalizedExtracted);
  const coveredSentences = sourceSentences.filter((sentence) =>
    chunkCorpus.includes(sentence),
  );

  const sourceTokens = tokenize(normalizedExtracted);
  const chunkTokens = tokenize(chunkCorpus);
  const sourceFreq = toFreqMap(sourceTokens);
  const chunkFreq = toFreqMap(chunkTokens);
  const missingTokens = topMissingTokens(sourceFreq, chunkFreq);

  const sourceMojibake = detectMojibakeCount(normalizedExtracted);
  const sourceDegree = detectDegreeCount(normalizedExtracted);

  printTitle('Integrity Coverage');
  console.log(`source chars: ${normalizedExtracted.length}`);
  console.log(`source sentences: ${sourceSentences.length}`);
  console.log(
    `sentence coverage: ${coveredSentences.length}/${sourceSentences.length}`,
  );
  console.log(`source tokens: ${sourceTokens.length}`);
  console.log(`chunk tokens: ${chunkTokens.length}`);

  printTitle('Source vs Chunk Signals');
  console.log(`mojibake markers in source: ${sourceMojibake}`);
  console.log(`mojibake markers in chunks: ${chunkMojibake}`);
  console.log(`degree symbols in source: ${sourceDegree}`);
  console.log(`degree symbols in chunks: ${chunkDegree}`);
  console.log(`broken degree patterns in chunks: ${chunkBrokenDegree}`);

  printTitle('Top Missing Tokens (source > chunks)');
  if (missingTokens.length === 0) {
    console.log('none');
  } else {
    for (const row of missingTokens) {
      console.log(`${row.token}: missing ${row.missing}`);
    }
  }

  printTitle('Verdict');
  const severeCorruption = chunkMojibake > Math.max(8, sourceMojibake + 4);
  const severeDegreeIssue = chunkBrokenDegree > 0;

  if (severeCorruption || severeDegreeIssue) {
    console.log('FAILED: corruption indicators detected in chunks.');
  } else {
    console.log('PASSED: no strong corruption indicators detected.');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nIntegrity check failed: ${message}`);
  process.exit(1);
});
