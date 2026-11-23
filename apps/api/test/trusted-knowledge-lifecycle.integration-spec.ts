import { createConnection, type Connection, Types } from 'mongoose';
import { AiDocument, AiDocumentSchema, DocumentReviewStatus, DocumentStatus } from '../src/modules/ai-advisory/domain/entities/knowledge-base/documents/ai-document.entity';
import { AiDocumentChunk, AiDocumentChunkSchema } from '../src/modules/ai-advisory/domain/entities/knowledge-base/chunks/ai-document-chunk.entity';

jest.setTimeout(30_000);
const baseUri = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27018/healthcare_phase_b?replicaSet=rs0&directConnection=true';

describe('trusted knowledge document lifecycle (integration)', () => {
  let connection: Connection;
  beforeAll(async () => {
    const uri = new URL(baseUri); uri.pathname = `/healthcare_phase_b_${new Types.ObjectId().toHexString()}`;
    connection = await createConnection(uri.toString(), { serverSelectionTimeoutMS: 5_000 }).asPromise();
    connection.model(AiDocument.name, AiDocumentSchema); connection.model(AiDocumentChunk.name, AiDocumentChunkSchema);
    await Promise.all([connection.model(AiDocument.name).init(), connection.model(AiDocumentChunk.name).init()]);
  });
  afterAll(async () => { if (connection) { await connection.dropDatabase(); await connection.close(); } });

  it('does not allow duplicate retry chunks and removes an archived version from eligibility', async () => {
    const documents = connection.model(AiDocument.name);
    const chunks = connection.model(AiDocumentChunk.name);
    const document = await documents.create({ title: 'Hướng dẫn', fileUrl: 'private', fileType: 'pdf', publicId: 'private', contentHash: 'hash-1', uploadedBy: new Types.ObjectId(), knowledgeLanguage: 'vi', scope: 'general', status: DocumentStatus.ACTIVE, reviewStatus: DocumentReviewStatus.APPROVED });
    await chunks.create({ documentId: document._id, documentVersion: 1, contentHash: 'hash-1', knowledgeLanguage: 'vi', scope: 'general', chunkIndex: 0, content: 'Nội dung đã duyệt', embedding: [0.1], isActive: true, reviewStatus: DocumentReviewStatus.APPROVED });
    await expect(chunks.create({ documentId: document._id, documentVersion: 1, contentHash: 'hash-1', knowledgeLanguage: 'vi', scope: 'general', chunkIndex: 0, content: 'retry', embedding: [0.1] })).rejects.toThrow();
    await documents.updateOne({ _id: document._id }, { $set: { status: DocumentStatus.INACTIVE, reviewStatus: DocumentReviewStatus.ARCHIVED } });
    const eligible = await documents.exists({ _id: document._id, status: DocumentStatus.ACTIVE, reviewStatus: DocumentReviewStatus.APPROVED });
    expect(eligible).toBeNull();
  });
});
