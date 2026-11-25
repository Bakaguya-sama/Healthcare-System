import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const FAMILY_REMINDER_DELIVERY_VERSION = 202611241040;
export const FAMILY_REMINDER_DELIVERY_NAME = 'e2-family-reminder-delivery';
export const FAMILY_REMINDER_QUOTA_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['companionUserId', 'createdAt', 'updatedAt'],
    properties: {
      companionUserId: { bsonType: 'objectId' },
      lastMissedTaskDispatchedAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

export const FAMILY_REMINDER_DELIVERY_INDEXES = [
  {
    collection: 'familyreminderquotas',
    name: 'companionUserId_1_unique',
    key: { companionUserId: 1 },
    unique: true,
  },
  {
    collection: 'caretasks',
    name: 'status_1_required_1__id_1',
    key: { status: 1, required: 1, _id: 1 },
  },
] as const;

export const FAMILY_REMINDER_DELIVERY_CHECKSUM = migrationChecksum({
  version: FAMILY_REMINDER_DELIVERY_VERSION,
  name: FAMILY_REMINDER_DELIVERY_NAME,
  collection: 'familyreminderquotas',
  indexes: FAMILY_REMINDER_DELIVERY_INDEXES,
  validator: FAMILY_REMINDER_QUOTA_VALIDATOR,
});

export async function applyFamilyReminderDelivery(db: Db): Promise<void> {
  const exists = await db
    .listCollections({ name: 'familyreminderquotas' }, { nameOnly: true })
    .hasNext();
  if (!exists) {
    await db.createCollection('familyreminderquotas', {
      validator: FAMILY_REMINDER_QUOTA_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  } else {
    await db.command({
      collMod: 'familyreminderquotas',
      validator: FAMILY_REMINDER_QUOTA_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
  for (const index of FAMILY_REMINDER_DELIVERY_INDEXES) {
    await db.collection(index.collection).createIndex(
      index.key as Document,
      {
        name: index.name,
        ...('unique' in index && index.unique ? { unique: true } : {}),
      },
    );
  }
}
