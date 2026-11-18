import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const TRUSTED_KNOWLEDGE_DOCUMENTS_VERSION = 202611181230;
export const TRUSTED_KNOWLEDGE_DOCUMENTS_NAME = 'trusted-knowledge-documents';
export const TRUSTED_KNOWLEDGE_DOCUMENTS_CHECKSUM = migrationChecksum({ version: TRUSTED_KNOWLEDGE_DOCUMENTS_VERSION, name: TRUSTED_KNOWLEDGE_DOCUMENTS_NAME, semantics: 'provenance lifecycle and retrieval indexes for trusted knowledge documents' });

export async function applyTrustedKnowledgeDocuments(db: Db): Promise<void> {
  await db.collection('aidocuments').updateMany({ documentVersion: { $exists: false } }, { $set: { documentVersion: 1, ingestionVersion: 1, knowledgeLanguage: 'vi', scope: 'general', source: 'internal' } });
  await db.collection('aidocumentchunks').updateMany({ documentVersion: { $exists: false } }, { $set: { documentVersion: 1, knowledgeLanguage: 'vi', scope: 'general' } });
  await db.collection('aidocuments').createIndex({ reviewStatus: 1, status: 1, scope: 1, knowledgeLanguage: 1 }, { name: 'reviewStatus_1_status_1_scope_1_knowledgeLanguage_1' });
  await db.collection('aidocuments').createIndex({ parentDocumentId: 1, documentVersion: -1 }, { name: 'parentDocumentId_1_documentVersion_-1' });
  await db.collection('aidocumentchunks').createIndex({ documentId: 1, documentVersion: 1, chunkIndex: 1 }, { name: 'documentId_1_documentVersion_1_chunkIndex_1', unique: true });
  await db.collection('aidocumentchunks').createIndex({ reviewStatus: 1, isActive: 1, scope: 1, knowledgeLanguage: 1, validUntil: 1 }, { name: 'reviewStatus_1_isActive_1_scope_1_knowledgeLanguage_1_validUntil_1' });
}
