import { isDeepStrictEqual } from 'node:util';
import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const CONSULTATION_SLOT_PARTIAL_UNIQUE_VERSION = 202611231200;
export const CONSULTATION_SLOT_PARTIAL_UNIQUE_NAME =
  'consultation-slot-partial-unique';
export const CONSULTATION_SLOT_PARTIAL_UNIQUE_CHECKSUM = migrationChecksum({
  version: CONSULTATION_SLOT_PARTIAL_UNIQUE_VERSION,
  name: CONSULTATION_SLOT_PARTIAL_UNIQUE_NAME,
  semantics:
    'partial unique availabilitySlotId_1 index scoped to pending and accepted consultations',
});

export const CONSULTATION_SLOT_PARTIAL_UNIQUE_INDEX = {
  collection: 'consultations',
  name: 'availabilitySlotId_1',
  key: { availabilitySlotId: 1 },
  unique: true,
  partialFilterExpression: {
    availabilitySlotId: { $type: 'objectId' },
    requestStatus: { $in: ['pending', 'accepted'] },
  },
} as const;

export async function applyConsultationSlotPartialUnique(db: Db): Promise<void> {
  const exists = await db
    .listCollections({ name: 'consultations' }, { nameOnly: true })
    .hasNext();
  if (!exists) return;

  const collection = db.collection('consultations');
  const indexes = await collection.listIndexes().toArray();
  const actual = indexes.find((index) => index.name === 'availabilitySlotId_1');
  const expectedFilter = {
    availabilitySlotId: { $type: 'objectId' },
    requestStatus: { $in: ['pending', 'accepted'] },
  };

  if (
    actual &&
    (actual.sparse === true ||
      actual.unique !== true ||
      !isDeepStrictEqual(actual.partialFilterExpression, expectedFilter))
  ) {
    await collection.dropIndex('availabilitySlotId_1');
  }

  await collection.createIndex(
    { availabilitySlotId: 1 },
    {
      name: 'availabilitySlotId_1',
      unique: true,
      partialFilterExpression: expectedFilter,
    },
  );
}

