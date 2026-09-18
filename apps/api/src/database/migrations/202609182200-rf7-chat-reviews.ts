import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const RF7_CHAT_REVIEWS_VERSION = 202609182200;
export const RF7_CHAT_REVIEWS_NAME = 'rf7-chat-reviews';
export const RF7_CHAT_REVIEWS_CHECKSUM = migrationChecksum({
  version: RF7_CHAT_REVIEWS_VERSION,
  name: RF7_CHAT_REVIEWS_NAME,
  steps: ['backfill-consultation-references', 'create-idempotency-and-review-indexes'],
});

export async function applyRf7ChatReviews(db: Db): Promise<void> {
  const messages = db.collection('messages');
  const reviews = db.collection('reviews');

  await messages.updateMany(
    { consultationId: { $exists: false }, doctorSessionId: { $exists: true } },
    [{ $set: { consultationId: '$doctorSessionId' } }],
  );
  await reviews.updateMany(
    { consultationId: { $exists: false }, doctorSessionId: { $exists: true } },
    [{ $set: { consultationId: '$doctorSessionId' } }],
  );

  // Preserve duplicate legacy reviews, but only one canonical review can claim a consultation.
  const duplicates = await reviews.aggregate([
    { $match: { consultationId: { $exists: true } } },
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: { _id: '$consultationId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  for (const duplicate of duplicates) {
    const legacyIds = (duplicate.ids as import('mongodb').ObjectId[]).slice(1);
    if (legacyIds.length > 0) await reviews.updateMany({ _id: { $in: legacyIds } }, { $unset: { consultationId: '' } });
  }

  await messages.createIndex({ consultationId: 1, sentAt: -1, _id: -1 }, { name: 'consultationId_1_sentAt_-1__id_-1' });
  await messages.createIndex(
    { consultationId: 1, clientMessageId: 1 },
    { name: 'consultationId_1_clientMessageId_1_unique', unique: true, partialFilterExpression: { consultationId: { $exists: true }, clientMessageId: { $exists: true } } },
  );
  await reviews.createIndex({ consultationId: 1 }, { name: 'consultationId_unique', unique: true, sparse: true });
  await reviews.createIndex({ doctorId: 1, createdAt: -1, _id: -1 }, { name: 'doctorId_1_createdAt_-1__id_-1' });
}
