import type { Db, Document } from 'mongodb';
import { migrationChecksum } from './migration.types';
import { MEDICAL_FACILITIES_VALIDATOR } from './202611251100-e3-medical-facility-directory';
import { facilityDuplicateSearchTokens } from '../../modules/care-directory/domain/policies/facility-duplicate-policy';
import type { FacilityAddress } from '../../modules/care-directory/domain/care-directory.types';

export const E3_FACILITY_DUPLICATE_REVIEW_VERSION = 202611271000;
export const E3_FACILITY_DUPLICATE_REVIEW_NAME = 'e3-facility-duplicate-review';

const facilityProperties = MEDICAL_FACILITIES_VALIDATOR.$jsonSchema.properties;
export const E3_DUPLICATE_REVIEW_FACILITIES_VALIDATOR = {
  $jsonSchema: {
    ...MEDICAL_FACILITIES_VALIDATOR.$jsonSchema,
    properties: {
      ...facilityProperties,
      duplicateSearchTokens: {
        bsonType: 'array',
        maxItems: 50,
        items: { bsonType: 'string', minLength: 1, maxLength: 100 },
      },
      duplicateLocation: {
        bsonType: ['object', 'null'],
        properties: {
          type: { enum: ['Point'] },
          coordinates: {
            bsonType: 'array',
            minItems: 2,
            maxItems: 2,
            items: { bsonType: ['double', 'int', 'long'] },
          },
        },
      },
      duplicateReviews: {
        bsonType: 'array',
        maxItems: 50,
        items: {
          bsonType: 'object',
          required: ['candidateFacilityId', 'reviewedBy', 'reason', 'reviewedAt'],
          properties: {
            candidateFacilityId: { bsonType: 'objectId' },
            reviewedBy: { bsonType: 'objectId' },
            reason: { bsonType: 'string', minLength: 10, maxLength: 300 },
            reviewedAt: { bsonType: 'date' },
          },
        },
      },
    },
  },
};

export const FACILITY_DUPLICATE_GUARDS_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['_id', 'revision'],
    properties: {
      _id: { bsonType: 'string', enum: ['hcmc'] },
      revision: { bsonType: ['int', 'long', 'double'], minimum: 0 },
    },
  },
};

export const E3_FACILITY_DUPLICATE_COLLECTIONS = [
  {
    name: 'facilityduplicateguards',
    validator: FACILITY_DUPLICATE_GUARDS_VALIDATOR,
  },
] as const;

export const E3_FACILITY_DUPLICATE_INDEXES = [
  {
    collection: 'medicalfacilities',
    name: 'status_1_duplicateSearchTokens_1__id_1',
    key: { status: 1, duplicateSearchTokens: 1, _id: 1 },
  },
  {
    collection: 'medicalfacilities',
    name: 'facility_duplicate_location_2dsphere',
    key: { duplicateLocation: '2dsphere' },
  },
] as const;

export const E3_FACILITY_DUPLICATE_REVIEW_CHECKSUM = migrationChecksum({
  version: E3_FACILITY_DUPLICATE_REVIEW_VERSION,
  name: E3_FACILITY_DUPLICATE_REVIEW_NAME,
  facilityValidator: E3_DUPLICATE_REVIEW_FACILITIES_VALIDATOR,
  collections: E3_FACILITY_DUPLICATE_COLLECTIONS,
  indexes: E3_FACILITY_DUPLICATE_INDEXES,
  duplicateSearchTokens: 'derived-from-internal-name-address-only',
  pairDecisions: 'embedded-in-medicalfacilities',
  verificationGuard: 'single-short-transaction-guard-for-hcmc-pilot',
});

export async function applyE3FacilityDuplicateReview(db: Db): Promise<void> {
  await ensureCollection(
    db,
    'medicalfacilities',
    E3_DUPLICATE_REVIEW_FACILITIES_VALIDATOR,
  );
  for (const collection of E3_FACILITY_DUPLICATE_COLLECTIONS)
    await ensureCollection(db, collection.name, collection.validator);

  await backfillDuplicateLookupFields(db);
  await db
    .collection<{ _id: string; revision: number }>('facilityduplicateguards')
    .updateOne(
      { _id: 'hcmc' },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );

  for (const index of E3_FACILITY_DUPLICATE_INDEXES) {
    const options: Record<string, unknown> = { name: index.name };
    if ('unique' in index) options.unique = index.unique;
    await db
      .collection(index.collection)
      .createIndex(index.key as Document, options);
  }
}

async function ensureCollection(
  db: Db,
  name: string,
  validator: Document,
): Promise<void> {
  const exists = await db
    .listCollections({ name }, { nameOnly: true })
    .hasNext();
  if (!exists) {
    await db.createCollection(name, {
      validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    return;
  }
  await db.command({
    collMod: name,
    validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

async function backfillDuplicateLookupFields(db: Db): Promise<void> {
  const facilities = db.collection('medicalfacilities');
  const revisions = db.collection('medicalfacilityrevisions');
  const cursor = facilities.find(
    {},
    {
      projection: {
        _id: 1,
        status: 1,
        name: 1,
        address: 1,
        location: 1,
        draftRevisionId: 1,
      },
    },
  );

  for await (const facility of cursor) {
    let name = typeof facility.name === 'string' ? facility.name : undefined;
    let address = facility.address as FacilityAddress | undefined;
    let location = facility.location as Record<string, unknown> | undefined;
    if (facility.status === 'draft' && facility.draftRevisionId) {
      const draft = await revisions.findOne(
        {
          _id: facility.draftRevisionId,
          facilityId: facility._id,
          status: 'draft',
        },
        {
          projection: {
            'details.name': 1,
            'details.address': 1,
            'details.location': 1,
          },
        },
      );
      const details = draft?.details as Record<string, unknown> | undefined;
      name = typeof details?.name === 'string' ? details.name : name;
      address = (details?.address as FacilityAddress | undefined) ?? address;
      location =
        (details?.location as Record<string, unknown> | undefined) ?? location;
    }

    const tokens = facilityDuplicateSearchTokens({ name, address });
    const set: Record<string, unknown> = { duplicateSearchTokens: tokens };
    if (isGeoPoint(location)) set.duplicateLocation = location;
    else set.duplicateLocation = null;
    await facilities.updateOne({ _id: facility._id }, { $set: set });
  }
}

function isGeoPoint(value: Record<string, unknown> | undefined): boolean {
  if (!value || value.type !== 'Point' || !Array.isArray(value.coordinates))
    return false;
  if (value.coordinates.length !== 2) return false;
  const [longitude, latitude] = value.coordinates;
  return typeof longitude === 'number' && typeof latitude === 'number';
}
