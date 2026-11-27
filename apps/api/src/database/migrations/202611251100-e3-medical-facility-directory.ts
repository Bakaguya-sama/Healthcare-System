import type { Db, Document } from 'mongodb';
import { isDeepStrictEqual } from 'node:util';
import { migrationChecksum } from './migration.types';

export const E3_FACILITY_DIRECTORY_VERSION = 202611251100;
export const E3_FACILITY_DIRECTORY_NAME = 'e3-medical-facility-directory';

const commonString = { bsonType: 'string' };
const optionalString = { bsonType: ['string', 'null'] };
const dateValue = { bsonType: 'date' };
const objectIdValue = { bsonType: 'objectId' };

export const MEDICAL_SPECIALTIES_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['code', 'nameVi', 'synonyms', 'status', 'revision', 'createdBy'],
    properties: {
      code: { bsonType: 'string', minLength: 2, maxLength: 60 },
      nameVi: { bsonType: 'string', minLength: 2, maxLength: 120 },
      synonyms: { bsonType: 'array', items: commonString },
      status: { enum: ['active', 'retired'] },
      revision: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      createdBy: objectIdValue,
      updatedBy: { bsonType: ['objectId', 'null'] },
      createdAt: dateValue,
      updatedAt: dateValue,
    },
  },
};

export const DISEASE_SPECIALTIES_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['scope', 'scopeKey', 'version', 'revision', 'status', 'specialtyCodes', 'sourceReferences', 'createdBy'],
    properties: {
      scope: { enum: ['program', 'disease'] },
      scopeKey: { bsonType: 'string', minLength: 2, maxLength: 80 },
      version: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      revision: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      status: { enum: ['draft', 'published', 'retired'] },
      specialtyCodes: { bsonType: 'array', minItems: 1, items: commonString },
      sourceReferences: { bsonType: 'array', minItems: 1, items: commonString },
      createdBy: objectIdValue,
      updatedBy: { bsonType: ['objectId', 'null'] },
      publishedBy: { bsonType: ['objectId', 'null'] },
      publishedAt: { bsonType: ['date', 'null'] },
      retiredBy: { bsonType: ['objectId', 'null'] },
      retiredAt: { bsonType: ['date', 'null'] },
      createdAt: dateValue,
      updatedAt: dateValue,
    },
  },
};

export const MEDICAL_FACILITIES_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['status', 'revision', 'specialtyCodes', 'createdBy'],
    properties: {
      status: { enum: ['draft', 'verified', 'retired'] },
      revision: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      currentRevisionId: { bsonType: ['objectId', 'null'] },
      draftRevisionId: { bsonType: ['objectId', 'null'] },
      name: { bsonType: ['string', 'null'], maxLength: 180 },
      normalizedName: { bsonType: ['string', 'null'], maxLength: 200 },
      facilityType: { enum: ['hospital', 'general_hospital', 'medical_center', 'clinic', null] },
      address: { bsonType: ['object', 'null'] },
      location: { bsonType: ['object', 'null'] },
      specialtyCodes: { bsonType: 'array', items: commonString },
      services: { bsonType: ['array', 'null'], items: commonString },
      contact: { bsonType: ['object', 'null'] },
      officialSourceUrl: optionalString,
      googlePlaceId: { bsonType: ['string', 'null'], maxLength: 256 },
      createdBy: objectIdValue,
      verifiedBy: { bsonType: ['objectId', 'null'] },
      verifiedAt: { bsonType: ['date', 'null'] },
      lastCheckedAt: { bsonType: ['date', 'null'] },
      retiredBy: { bsonType: ['objectId', 'null'] },
      retiredAt: { bsonType: ['date', 'null'] },
      createdAt: dateValue,
      updatedAt: dateValue,
    },
  },
};

export const MEDICAL_FACILITY_REVISIONS_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['facilityId', 'version', 'revision', 'status', 'details', 'createdBy'],
    properties: {
      facilityId: objectIdValue,
      version: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      revision: { bsonType: ['int', 'long', 'double'], minimum: 1 },
      status: { enum: ['draft', 'verified', 'superseded'] },
      details: { bsonType: 'object' },
      createdBy: objectIdValue,
      updatedBy: { bsonType: ['objectId', 'null'] },
      verifiedBy: { bsonType: ['objectId', 'null'] },
      verifiedAt: { bsonType: ['date', 'null'] },
      createdAt: dateValue,
      updatedAt: dateValue,
    },
  },
};

export const FACILITY_COMMAND_RECEIPTS_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['actorId', 'operation', 'keyHash', 'fingerprint', 'result', 'expiresAt', 'createdAt'],
    properties: {
      actorId: objectIdValue,
      operation: commonString,
      keyHash: commonString,
      fingerprint: commonString,
      result: { bsonType: 'object' },
      expiresAt: dateValue,
      createdAt: dateValue,
    },
  },
};

export const E3_FACILITY_DIRECTORY_COLLECTIONS = [
  { name: 'medicalspecialties', validator: MEDICAL_SPECIALTIES_VALIDATOR },
  { name: 'diseasespecialties', validator: DISEASE_SPECIALTIES_VALIDATOR },
  { name: 'medicalfacilities', validator: MEDICAL_FACILITIES_VALIDATOR },
  { name: 'medicalfacilityrevisions', validator: MEDICAL_FACILITY_REVISIONS_VALIDATOR },
  { name: 'facilitycommandreceipts', validator: FACILITY_COMMAND_RECEIPTS_VALIDATOR },
] as const;

export const E3_FACILITY_DIRECTORY_INDEXES = [
  { collection: 'medicalspecialties', name: 'code_1_unique', key: { code: 1 }, unique: true },
  { collection: 'medicalspecialties', name: 'status_1_nameVi_1_code_1', key: { status: 1, nameVi: 1, code: 1 } },
  { collection: 'diseasespecialties', name: 'scope_1_scopeKey_1_version_1_unique', key: { scope: 1, scopeKey: 1, version: 1 }, unique: true },
  { collection: 'diseasespecialties', name: 'one_published_mapping_per_scope', key: { scope: 1, scopeKey: 1 }, unique: true, partialFilterExpression: { status: 'published' } },
  { collection: 'diseasespecialties', name: 'status_1_scope_1_scopeKey_1', key: { status: 1, scope: 1, scopeKey: 1 } },
  { collection: 'medicalfacilities', name: 'status_1_specialtyCodes_1__id_1', key: { status: 1, specialtyCodes: 1, _id: 1 } },
  { collection: 'medicalfacilities', name: 'status_1_province_district_id', key: { status: 1, 'address.provinceCode': 1, 'address.district': 1, _id: 1 } },
  { collection: 'medicalfacilities', name: 'verified_location_2dsphere', key: { location: '2dsphere' }, partialFilterExpression: { status: 'verified' } },
  { collection: 'medicalfacilities', name: 'googlePlaceId_1_unique', key: { googlePlaceId: 1 }, unique: true, partialFilterExpression: { googlePlaceId: { $type: 'string' } } },
  { collection: 'medicalfacilityrevisions', name: 'facilityId_1_version_1_unique', key: { facilityId: 1, version: 1 }, unique: true },
  { collection: 'medicalfacilityrevisions', name: 'facilityId_1_status_1_version_-1', key: { facilityId: 1, status: 1, version: -1 } },
  { collection: 'facilitycommandreceipts', name: 'actor_operation_keyhash_unique', key: { actorId: 1, operation: 1, keyHash: 1 }, unique: true },
  { collection: 'facilitycommandreceipts', name: 'facility_command_receipt_ttl', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
] as const;

export const E3_FACILITY_DIRECTORY_CHECKSUM = migrationChecksum({
  version: E3_FACILITY_DIRECTORY_VERSION,
  name: E3_FACILITY_DIRECTORY_NAME,
  collections: E3_FACILITY_DIRECTORY_COLLECTIONS,
  indexes: E3_FACILITY_DIRECTORY_INDEXES,
  providerPersistence: ['googlePlaceId only'],
});

export async function applyE3FacilityDirectory(db: Db): Promise<void> {
  // `medicalfacilities` existed as a documented target before E3 had runtime.
  // Do not silently validate/promote old records as reviewed directory content.
  // An owner must classify any pre-existing rows before this migration proceeds.
  for (const { name, validator } of E3_FACILITY_DIRECTORY_COLLECTIONS) {
    const existing = await db.listCollections({ name }, { nameOnly: false }).next();
    if (existing && await db.collection(name).countDocuments({}) > 0 && !isDeepStrictEqual(existing.options?.validator, validator)) {
      throw new Error(`E3 data review required before schema migration: ${name}`);
    }
  }
  for (const { name, validator } of E3_FACILITY_DIRECTORY_COLLECTIONS) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) {
      await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    } else {
      await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    }
  }
  for (const index of E3_FACILITY_DIRECTORY_INDEXES) {
    const options: Record<string, unknown> = { name: index.name };
    if ('unique' in index) options.unique = index.unique;
    if ('partialFilterExpression' in index) options.partialFilterExpression = index.partialFilterExpression;
    if ('expireAfterSeconds' in index) options.expireAfterSeconds = index.expireAfterSeconds;
    await db.collection(index.collection).createIndex(index.key as Document, options);
  }
}
