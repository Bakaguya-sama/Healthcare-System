import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const RF10B_CANONICAL_CLEANUP_VERSION = 202609202000;
export const RF10B_CANONICAL_CLEANUP_NAME = 'rf10b-canonical-cleanup';
export const RF10B_CANONICAL_CLEANUP_CHECKSUM = migrationChecksum({
  version: RF10B_CANONICAL_CLEANUP_VERSION,
  name: RF10B_CANONICAL_CLEANUP_NAME,
  steps: [
    'backfill-ai-feedback-conversation-id',
    'create-ai-feedback-conversation-index',
  ],
});

export async function applyRf10bCanonicalCleanup(db: Db): Promise<void> {
  const feedbacks = db.collection('aifeedbacks');
  const conversations = db.collection('aiconversations');

  for await (const feedback of feedbacks
    .find({
      aiConversationId: { $exists: false },
      aiSessionId: { $exists: true },
    })
    .batchSize(100)) {
    const conversation = await conversations.findOne({
      $or: [
        { _id: feedback.aiSessionId },
        { legacyAiSessionId: feedback.aiSessionId },
      ],
    });
    if (!conversation) continue;

    await feedbacks.updateOne(
      { _id: feedback._id, aiConversationId: { $exists: false } },
      { $set: { aiConversationId: conversation._id } },
    );
  }

  await feedbacks.createIndex(
    { aiConversationId: 1, createdAt: -1 },
    { name: 'aiConversationId_1_createdAt_-1' },
  );
}
