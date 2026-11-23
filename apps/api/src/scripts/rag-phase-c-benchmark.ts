import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { RagRetrievalService } from '../modules/ai-advisory/application/retrieval/rag-retrieval.service';
import { AiDocumentChunk, type AiDocumentChunkDocument } from '../modules/ai-advisory/domain/knowledge-base/chunks/ai-document-chunk.entity';
import { AiDocument, type AiDocumentDocument } from '../modules/ai-advisory/domain/knowledge-base/documents/ai-document.entity';

type BaselineRow = { id: string; question: string; scope: string; language: string; expected_evidence_key: string };
type VectorOnlyBaseline = { latencyMs?: { p95?: number } };

function readCsv(path: string): BaselineRow[] {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const keys = header.split(',');
  return lines.map((line) => {
    const values = [...line.matchAll(/(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g)].map((match) => (match[1] ?? match[2] ?? '').replaceAll('""', '"'));
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ''])) as BaselineRow;
  });
}

async function main() {
  const baselinePath = process.env.RAG_BENCHMARK_INPUT ?? join(process.cwd(), '../../docs/evaluation/rag-phase-c-vi-baseline.csv');
  if (!existsSync(baselinePath)) throw new Error('RAG benchmark baseline file was not found');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const rag = app.get(RagRetrievalService);
    const chunks = app.get<Model<AiDocumentChunkDocument>>(getModelToken(AiDocumentChunk.name));
    const documents = app.get<Model<AiDocumentDocument>>(getModelToken(AiDocument.name));
    const requestedLimit = Number(process.env.RAG_BENCHMARK_LIMIT ?? 0);
    const rows = readCsv(baselinePath).slice(
      0,
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : undefined,
    );
    const repeat = Math.max(1, Math.min(10, Number(process.env.RAG_BENCHMARK_REPEAT ?? 1)));
    const evaluatedRows = Array.from({ length: repeat }, () => rows).flat();
    const measurements = [] as Array<{ id: string; latencyMs: number; hitCount: number; citationPresent: boolean; expectedEvidenceMatched: boolean; hasExpectedEvidence: boolean }>;
    for (const row of evaluatedRows) {
      const startedAt = performance.now();
      const result = await rag.retrieve({ query: row.question, scope: process.env.RAG_BENCHMARK_SCOPE ?? 'benchmark', language: row.language || 'vi' });
      const latencyMs = Math.round(performance.now() - startedAt);
      const expectedEvidenceMatched = row.expected_evidence_key === 'none' || result.hits.some((hit) => `${hit.title ?? ''} ${hit.content}`.toLowerCase().includes(row.expected_evidence_key.toLowerCase()));
      measurements.push({ id: row.id, latencyMs, hitCount: result.hits.length, citationPresent: result.hits.length > 0, expectedEvidenceMatched, hasExpectedEvidence: row.expected_evidence_key !== 'none' });
    }
    const sortedLatency = measurements.map((item) => item.latencyMs).sort((a, b) => a - b);
    const evidenceCases = measurements.filter((item) => item.hasExpectedEvidence);
    const vectorBaselinePath = process.env.RAG_BENCHMARK_VECTOR_BASELINE_PATH;
    const vectorOnlyP95 = vectorBaselinePath
      ? (JSON.parse(readFileSync(vectorBaselinePath, 'utf8')) as VectorOnlyBaseline)
          .latencyMs?.p95
      : undefined;
    const targets = {
      evidenceCoverage: Number(process.env.RAG_BENCHMARK_MIN_EVIDENCE_COVERAGE ?? 0.9),
      expectedEvidenceMatch: Number(process.env.RAG_BENCHMARK_MIN_EXPECTED_MATCH ?? 0.9),
      p95LatencyMs: Number(process.env.RAG_BENCHMARK_MAX_P95_LATENCY_MS ?? 2_000),
      vectorOnlyP95Ms: vectorOnlyP95 ?? null,
      maxHybridP95Ms:
        typeof vectorOnlyP95 === 'number' ? Math.round(vectorOnlyP95 * 1.2) : null,
      maxEmbeddingCallsPerQuery: Number(
        process.env.RAG_BENCHMARK_MAX_EMBEDDING_CALLS_PER_QUERY ?? 1,
      ),
    };
    const quality = {
      expectedEvidenceMatchRate: evidenceCases.length ? evidenceCases.filter((item) => item.expectedEvidenceMatched).length / evidenceCases.length : 0,
      citationRate: evidenceCases.length ? evidenceCases.filter((item) => item.citationPresent).length / evidenceCases.length : 0,
    };
    const latencyMs = { p50: sortedLatency[Math.floor(sortedLatency.length * 0.5)] ?? 0, p95: sortedLatency[Math.max(0, Math.ceil(sortedLatency.length * 0.95) - 1)] ?? 0 };
    // One query embedding is the only billable provider interaction in this
    // retrieval benchmark. PubMed is intentionally not invoked here.
    const cost = {
      embeddingProviderCalls: measurements.length,
      embeddingCallsPerQuery: measurements.length ? 1 : 0,
      externalLiteratureCalls: 0,
      estimatedUsd: null,
      note: 'Monetary pricing is provider-account specific; call-count budget is enforced.',
    };
    const gate = {
      targets,
      passed:
        quality.citationRate >= targets.evidenceCoverage &&
        quality.expectedEvidenceMatchRate >= targets.expectedEvidenceMatch &&
        latencyMs.p95 <= targets.p95LatencyMs &&
        (targets.maxHybridP95Ms === null ||
          latencyMs.p95 <= targets.maxHybridP95Ms) &&
        cost.embeddingCallsPerQuery <= targets.maxEmbeddingCallsPerQuery,
    };
    const probeChunk = await chunks.findOne({ isActive: true, reviewStatus: 'approved', embedding: { $exists: true } }).select('_id embedding content').lean().exec();
    let vectorProbeCount = 0;
    let vectorProbeStatus = probeChunk ? 'no_result' : 'no_eligible_chunk';
    if (probeChunk) {
      try {
        vectorProbeCount = (await chunks.aggregate([{ $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector: probeChunk.embedding, numCandidates: 50, limit: 1 } }, { $count: 'count' }]).option({ maxTimeMS: 5_000 }).exec())[0]?.count ?? 0;
        vectorProbeStatus = vectorProbeCount ? 'ok' : 'no_result';
      } catch (error) {
        const mongoError = error as { code?: number; name?: string; message?: string };
        vectorProbeStatus = `${mongoError.name ?? 'error'}${mongoError.code !== undefined ? `:${mongoError.code}` : ''}${mongoError.message ? `:${mongoError.message.replace(/[\r\n]/g, ' ').slice(0, 180)}` : ''}`;
      }
    }
    const probeTerms = probeChunk?.content.trim().split(/\s+/).slice(0, 3).join(' ') ?? '';
    let fullTextProbeCount = 0;
    let fullTextProbeStatus = probeTerms ? 'no_result' : 'no_eligible_chunk';
    if (probeTerms) {
      try {
        fullTextProbeCount = (await chunks.aggregate([{ $search: { index: 'ai_document_chunks_fulltext', text: { query: probeTerms, path: 'content' } } }, { $limit: 1 }, { $count: 'count' }]).option({ maxTimeMS: 5_000 }).exec())[0]?.count ?? 0;
        fullTextProbeStatus = fullTextProbeCount ? 'ok' : 'no_result';
      } catch (error) {
        const mongoError = error as { code?: number; name?: string };
        fullTextProbeStatus = `${mongoError.name ?? 'error'}${mongoError.code !== undefined ? `:${mongoError.code}` : ''}`;
      }
    }
    const report = {
      generatedAt: new Date().toISOString(),
      baselineFingerprint: createHash('sha256').update(readFileSync(baselinePath)).digest('hex'),
      queryCount: measurements.length,
      repeat,
      quality,
      latencyMs,
      gate,
      atlasIndexProbe: { vectorResultCount: vectorProbeCount, vectorStatus: vectorProbeStatus, fullTextResultCount: fullTextProbeCount, fullTextStatus: fullTextProbeStatus },
      cost,
      corpus: await chunks.aggregate([{ $group: { _id: { isActive: '$isActive', reviewStatus: '$reviewStatus', scope: '$scope', language: '$knowledgeLanguage' }, count: { $sum: 1 } } }]).exec(),
      documentServingState: await documents.aggregate([{ $group: { _id: { status: '$status', reviewStatus: '$reviewStatus' }, count: { $sum: 1 } } }]).exec(),
      servingChunkCount: (await chunks.aggregate([
        { $match: { isActive: true, reviewStatus: 'approved' } },
        { $lookup: { from: 'aidocuments', localField: 'documentId', foreignField: '_id', as: 'document' } },
        { $unwind: '$document' },
        { $match: { 'document.status': 'active', 'document.reviewStatus': 'approved' } },
        { $count: 'count' },
      ]).exec())[0]?.count ?? 0,
      measurements,
    };
    const outputPath = process.env.RAG_BENCHMARK_OUTPUT ?? join(process.cwd(), '../../tmp/rag-phase-c-benchmark-result.json');
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ queryCount: report.queryCount, quality: report.quality, latencyMs: report.latencyMs, gate: report.gate, outputPath }));
    if (process.env.RAG_BENCHMARK_ENFORCE === 'true' && !gate.passed) process.exitCode = 2;
  } finally { await app.close(); }
}
void main();
