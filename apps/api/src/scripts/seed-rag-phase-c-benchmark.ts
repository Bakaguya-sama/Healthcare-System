import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { OutboxService } from '../infrastructure/outbox/outbox.service';
import { AuditLog, type AuditLogDocument } from '../modules/platform-audit/public-api';
import { EmbeddingService } from '../modules/ai-advisory/infrastructure/retrieval/google-embedding.service';
import { AiDocument, type AiDocumentDocument, DocumentReviewStatus, DocumentStatus } from '../modules/ai-advisory/domain/knowledge-base/documents/ai-document.entity';
import { AiDocumentChunk, type AiDocumentChunkDocument } from '../modules/ai-advisory/domain/knowledge-base/chunks/ai-document-chunk.entity';
import { User, type UserDocument } from '../modules/users/public-api';

type BaselineRow = { id: string; question: string; expected_evidence_key: string };
const BENCHMARK_SCOPE = 'benchmark';

function readBaseline(path: string): BaselineRow[] {
  const [header, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const keys = header.split(',');
  return lines.map((line) => {
    const values = [...line.matchAll(/(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g)].map((match) => (match[1] ?? match[2] ?? '').replaceAll('""', '"'));
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ''])) as BaselineRow;
  });
}

async function main(): Promise<void> {
  if (process.env.RAG_BENCHMARK_SEED_CONFIRMATION !== 'approved') {
    throw new Error('Set RAG_BENCHMARK_SEED_CONFIRMATION=approved to create the isolated synthetic benchmark corpus');
  }
  const baselinePath = process.env.RAG_BENCHMARK_INPUT ?? join(process.cwd(), '../../docs/evaluation/rag-phase-c-vi-baseline.csv');
  const baselineBytes = readFileSync(baselinePath);
  const fingerprint = createHash('sha256').update(baselineBytes).digest('hex');
  const rows = readBaseline(baselinePath).filter((row) => row.expected_evidence_key !== 'none');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const users = app.get<Model<UserDocument>>(getModelToken(User.name));
    const documents = app.get<Model<AiDocumentDocument>>(getModelToken(AiDocument.name));
    const chunks = app.get<Model<AiDocumentChunkDocument>>(getModelToken(AiDocumentChunk.name));
    const audits = app.get<Model<AuditLogDocument>>(getModelToken(AuditLog.name));
    const embeddings = app.get(EmbeddingService);
    const outbox = app.get(OutboxService);
    const approvingAdmin = await users.findOne({ role: 'admin', 'adminProfile.adminRole': 'super_admin' }).select('_id').lean().exec();
    if (!approvingAdmin?._id) throw new Error('A super_admin is required to authorize the benchmark corpus');
    const content = rows.map((row) => `Synthetic benchmark evidence key: ${row.expected_evidence_key}. This approved technical evaluation fixture supports the question: ${row.question}. It is not clinical guidance and is restricted to benchmark scope.`);
    const vectors = await embeddings.generateEmbeddings(content);
    let insertedOrUpdated = 0;
    for (const [index, row] of rows.entries()) {
      const text = content[index];
      const contentHash = createHash('sha256').update(`phase-c-benchmark:${fingerprint}:${row.id}`).digest('hex');
      await documents.updateOne(
        { contentHash },
        {
          $set: {
            title: `Phase C benchmark ${row.id}`,
            fileUrl: `benchmark://${row.id}`,
            fileType: 'txt',
            publicId: `benchmark-phase-c-${row.id}`,
            documentVersion: 1,
            knowledgeLanguage: 'vi',
            scope: BENCHMARK_SCOPE,
            source: 'benchmark_synthetic',
            ingestionVersion: 1,
            status: DocumentStatus.ACTIVE,
            reviewStatus: DocumentReviewStatus.APPROVED,
            uploadedBy: approvingAdmin._id,
            approvedBy: approvingAdmin._id,
            approvedAt: new Date(),
          },
          $setOnInsert: { contentHash },
        },
        { upsert: true },
      ).exec();
      const document = await documents.findOne({ contentHash }).select('_id').lean().exec();
      if (!document?._id) throw new Error('Benchmark document upsert did not return an identifier');
      await chunks.updateOne(
        { documentId: document._id, documentVersion: 1, chunkIndex: 0 },
        {
          $set: {
            contentHash,
            knowledgeLanguage: 'vi',
            scope: BENCHMARK_SCOPE,
            content: text,
            embedding: vectors[index],
            isActive: true,
            reviewStatus: DocumentReviewStatus.APPROVED,
            pageNumber: null,
            sectionTitle: 'synthetic benchmark evidence',
          },
          $setOnInsert: { documentId: document._id, documentVersion: 1, chunkIndex: 0 },
        },
        { upsert: true },
      ).exec();
      await audits.updateOne(
        { domain: 'knowledge_base', entityType: 'AiDocument', entityId: document._id, action: 'benchmark_corpus_seeded', 'metadata.baselineFingerprint': fingerprint },
        { $setOnInsert: { domain: 'knowledge_base', entityType: 'AiDocument', entityId: document._id, action: 'benchmark_corpus_seeded', actorId: approvingAdmin._id, toStatus: DocumentStatus.ACTIVE, reason: 'Product-owner-authorized synthetic benchmark corpus', metadata: { baselineFingerprint: fingerprint, benchmarkScope: BENCHMARK_SCOPE, synthetic: true } } },
        { upsert: true },
      ).exec();
      await outbox.enqueue({ eventType: 'knowledge.benchmark.seeded.v1', aggregateType: 'AiDocument', aggregateId: document._id, payload: { documentId: document._id.toString(), benchmarkScope: BENCHMARK_SCOPE, synthetic: true }, idempotencyKey: `knowledge.benchmark.seeded.${contentHash}` });
      insertedOrUpdated += 1;
    }
    console.log(JSON.stringify({ status: 'ok', benchmarkScope: BENCHMARK_SCOPE, documentCount: insertedOrUpdated, baselineFingerprint: fingerprint }));
  } finally { await app.close(); }
}

void main();
