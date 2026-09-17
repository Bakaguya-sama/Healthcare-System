import type { Db } from 'mongodb';
import { withDatabase } from './seed-utils';

export const REFERENCE_BLACKLIST_KEYWORDS = [
  'spam',
  'scam',
  'fraud',
  'harassment',
] as const;

export async function seedReferenceData(db: Db): Promise<void> {
  const collection = db.collection<{ keyword: string }>('blacklistkeywords');
  await collection.createIndex(
    { keyword: 1 },
    { name: 'keyword_1', unique: true },
  );
  await collection.bulkWrite(
    REFERENCE_BLACKLIST_KEYWORDS.map((keyword) => ({
      updateOne: {
        filter: { keyword },
        update: { $setOnInsert: { keyword } },
        upsert: true,
      },
    })),
  );
}

if (require.main === module) {
  void withDatabase(seedReferenceData)
    .then(() => console.log('reference seed applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
