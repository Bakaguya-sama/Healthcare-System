import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
export const EXTERNAL_KNOWLEDGE_CANDIDATES_VERSION = 202611181240;
export const EXTERNAL_KNOWLEDGE_CANDIDATES_NAME =
  'external-knowledge-candidates';
export const EXTERNAL_KNOWLEDGE_CANDIDATES_CHECKSUM = migrationChecksum({
  version: EXTERNAL_KNOWLEDGE_CANDIDATES_VERSION,
  name: EXTERNAL_KNOWLEDGE_CANDIDATES_NAME,
  semantics:
    'quarantined PubMed candidates with PMID and content-hash deduplication',
});
export async function applyExternalKnowledgeCandidates(db: Db): Promise<void> {
  await db
    .collection('knowledgecandidates')
    .createIndex({ pmid: 1 }, { name: 'pmid_1', unique: true });
  await db
    .collection('knowledgecandidates')
    .createIndex({ contentHash: 1 }, { name: 'contentHash_1', unique: true });
  await db
    .collection('knowledgecandidates')
    .createIndex(
      { status: 1, createdAt: -1 },
      { name: 'status_1_createdAt_-1' },
    );
}
