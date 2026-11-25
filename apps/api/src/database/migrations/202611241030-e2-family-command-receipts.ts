import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const FAMILY_COMMAND_RECEIPTS_VERSION = 202611241030;
export const FAMILY_COMMAND_RECEIPTS_NAME = 'e2-family-command-receipts';
export const FAMILY_COMMAND_RECEIPTS_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'actorId',
      'operation',
      'keyHash',
      'requestHash',
      'result',
      'createdAt',
    ],
    properties: {
      actorId: { bsonType: 'objectId' },
      operation: { bsonType: 'string', minLength: 1, maxLength: 80 },
      keyHash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
      requestHash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
      result: { bsonType: 'object' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};
export const FAMILY_COMMAND_RECEIPTS_CHECKSUM = migrationChecksum({
  version: FAMILY_COMMAND_RECEIPTS_VERSION,
  name: FAMILY_COMMAND_RECEIPTS_NAME,
  collection: 'familycommandreceipts',
  indexes: ['actor_operation_keyhash_unique', 'family_command_receipt_ttl'],
  validator: FAMILY_COMMAND_RECEIPTS_VALIDATOR,
});

export async function applyFamilyCommandReceipts(db: Db): Promise<void> {
  const exists = await db
    .listCollections({ name: 'familycommandreceipts' }, { nameOnly: true })
    .hasNext();
  if (!exists) {
    await db.createCollection('familycommandreceipts', {
      validator: FAMILY_COMMAND_RECEIPTS_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  } else {
    await db.command({
      collMod: 'familycommandreceipts',
      validator: FAMILY_COMMAND_RECEIPTS_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
  const receipts = db.collection('familycommandreceipts');
  await receipts.createIndex(
    { actorId: 1, operation: 1, keyHash: 1 },
    { name: 'actor_operation_keyhash_unique', unique: true },
  );
  await receipts.createIndex(
    { createdAt: 1 },
    { name: 'family_command_receipt_ttl', expireAfterSeconds: 604800 },
  );
}
