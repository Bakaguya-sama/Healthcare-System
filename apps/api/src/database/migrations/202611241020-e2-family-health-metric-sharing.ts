import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const FAMILY_HEALTH_SHARING_VERSION = 202611241020;
export const FAMILY_HEALTH_SHARING_NAME = 'e2-family-health-metric-sharing';
export const FAMILY_HEALTH_SHARING_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'familyLinkId',
      'patientId',
      'familyUserId',
      'invitationVersion',
      'revision',
      'status',
      'scope',
      'consentVersion',
      'consentedBy',
      'consentedAt',
    ],
    properties: {
      familyLinkId: { bsonType: 'objectId' },
      patientId: { bsonType: 'objectId' },
      familyUserId: { bsonType: 'objectId' },
      invitationVersion: {
        bsonType: ['int', 'long', 'double', 'decimal'],
        minimum: 1,
      },
      revision: { bsonType: ['int', 'long', 'double', 'decimal'], minimum: 1 },
      status: { enum: ['active', 'revoked', 'superseded'] },
      scope: { enum: ['all', 'selected'] },
      metricTypes: { bsonType: 'array', items: { bsonType: 'string' } },
      consentVersion: { bsonType: 'string' },
      consentedBy: { bsonType: 'objectId' },
      consentedAt: { bsonType: 'date' },
      revokedAt: { bsonType: 'date' },
      revokedBy: { bsonType: 'objectId' },
    },
  },
};
export const FAMILY_HEALTH_SHARING_CHECKSUM = migrationChecksum({
  version: FAMILY_HEALTH_SHARING_VERSION,
  name: FAMILY_HEALTH_SHARING_NAME,
  collection: 'familyhealthmetricsharings',
  indexes: ['family_link_invitation_revision', 'family_link_active_sharing'],
  validator: FAMILY_HEALTH_SHARING_VALIDATOR,
});

export async function applyFamilyHealthSharing(db: Db): Promise<void> {
  const exists = await db
    .listCollections({ name: 'familyhealthmetricsharings' }, { nameOnly: true })
    .hasNext();
  if (!exists)
    await db.createCollection('familyhealthmetricsharings', {
      validator: FAMILY_HEALTH_SHARING_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  else
    await db.command({
      collMod: 'familyhealthmetricsharings',
      validator: FAMILY_HEALTH_SHARING_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  const collection = db.collection('familyhealthmetricsharings');
  await collection.createIndex(
    { familyLinkId: 1, invitationVersion: 1, revision: 1 },
    { name: 'family_link_invitation_revision', unique: true },
  );
  await collection.createIndex(
    { familyLinkId: 1, invitationVersion: 1 },
    {
      name: 'family_link_active_sharing',
      unique: true,
      partialFilterExpression: { status: 'active' },
    },
  );
}
