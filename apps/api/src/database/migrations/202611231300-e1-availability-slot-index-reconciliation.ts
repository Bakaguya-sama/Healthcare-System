import type { Db, ObjectId } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E1_AVAILABILITY_SLOT_INDEX_RECONCILIATION_VERSION = 202611231300;
export const E1_AVAILABILITY_SLOT_INDEX_RECONCILIATION_NAME =
  'e1-availability-slot-index-reconciliation';
export const E1_AVAILABILITY_SLOT_INDEX_RECONCILIATION_CHECKSUM =
  migrationChecksum({
    version: E1_AVAILABILITY_SLOT_INDEX_RECONCILIATION_VERSION,
    name: E1_AVAILABILITY_SLOT_INDEX_RECONCILIATION_NAME,
    target: 'consultations.availabilitySlotId_1.unique.sparse',
    duplicatePolicy:
      'retain-oldest-cancelled-record-unset-newer-cancelled-links',
  });

/** Reconciles an existing index option drift detected by database:verify. */
export async function applyE1AvailabilitySlotIndexReconciliation(
  db: Db,
): Promise<void> {
  const collection = db.collection('consultations');
  const duplicates = await collection
    .aggregate<{
      _id: unknown;
      records: Array<{
        _id: ObjectId;
        requestStatus?: string;
        createdAt?: Date;
      }>;
    }>([
      { $match: { availabilitySlotId: { $exists: true } } },
      {
        $group: {
          _id: '$availabilitySlotId',
          records: {
            $push: {
              _id: '$_id',
              requestStatus: '$requestStatus',
              createdAt: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const duplicate of duplicates) {
    const records = [...duplicate.records].sort(
      (left, right) =>
        (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0),
    );
    if (records.some((record) => record.requestStatus !== 'cancelled')) {
      throw new Error(
        'Cannot reconcile availability-slot links while an active duplicate exists',
      );
    }
    // Cancelled consultations no longer need the slot for slot lifecycle. Keep
    // the earliest historic link and remove only redundant, terminal links.
    for (const record of records.slice(1)) {
      await collection.updateOne(
        { _id: record._id, requestStatus: 'cancelled' },
        { $unset: { availabilitySlotId: '' } },
      );
    }
  }
  const indexes = (await collection.listIndexes().toArray()) as Array<{
    name?: string;
    sparse?: boolean;
    unique?: boolean;
  }>;
  const index = indexes.find((item) => item.name === 'availabilitySlotId_1');
  if (index && (index.sparse !== true || index.unique !== true)) {
    await collection.dropIndex('availabilitySlotId_1');
  }
  if (!index || index.sparse !== true || index.unique !== true) {
    await collection.createIndex(
      { availabilitySlotId: 1 },
      { name: 'availabilitySlotId_1', unique: true, sparse: true },
    );
  }
}
