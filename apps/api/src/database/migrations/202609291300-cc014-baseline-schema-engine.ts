import type { Db, Document } from 'mongodb';
import { CC000_FOUNDATION_COLLECTIONS } from './202609281000-cc000-chronic-care-foundation';
import { migrationChecksum } from './migration.types';

export const CC014_BASELINE_SCHEMA_ENGINE_VERSION = 202609291300;
export const CC014_BASELINE_SCHEMA_ENGINE_NAME = 'cc014-baseline-schema-engine';
export const CC014_BASELINE_SCHEMA_ENGINE_CHECKSUM = migrationChecksum({
  version: CC014_BASELINE_SCHEMA_ENGINE_VERSION,
  name: CC014_BASELINE_SCHEMA_ENGINE_NAME,
  steps: [
    'normalize-baseline-schema-v1',
    'snapshot-enrollment-baseline-schema-version',
    'enforce-baseline-schema-contract',
  ],
});

function baselineFormSchema(): Document {
  return {
    bsonType: 'object',
    required: ['schemaVersion', 'fields'],
    additionalProperties: false,
    properties: {
      schemaVersion: { enum: ['v1'] },
      fields: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['key', 'type', 'required', 'visibility'],
          additionalProperties: false,
          properties: {
            key: { bsonType: 'string', pattern: '^[a-z][a-z0-9_]{0,63}$' },
            type: { enum: ['number', 'integer', 'boolean', 'string', 'date'] },
            unit: { bsonType: 'string', maxLength: 32 },
            range: {
              bsonType: 'object',
              additionalProperties: false,
              properties: {
                min: { bsonType: 'number' },
                max: { bsonType: 'number' },
              },
            },
            required: { bsonType: 'bool' },
            visibility: { enum: ['patient', 'care_team'] },
          },
        },
      },
    },
  };
}

function collectionContract(name: 'careprograms' | 'patientcareprograms') {
  const source = CC000_FOUNDATION_COLLECTIONS.find(
    (collection) => collection.name === name,
  );
  if (!source) throw new Error(`missing ${name} foundation contract`);
  const validator = JSON.parse(JSON.stringify(source.validator)) as Document;
  const schema = validator.$jsonSchema as Record<string, any>;
  if (name === 'careprograms')
    schema.properties.baselineForm = baselineFormSchema();
  if (name === 'patientcareprograms') {
    schema.required.push('baselineSchemaVersion');
    schema.properties.baselineSchemaVersion = { bsonType: 'string' };
  }
  return { name, validator };
}

export const CC014_BASELINE_SCHEMA_COLLECTIONS = [
  collectionContract('careprograms'),
  collectionContract('patientcareprograms'),
] as const;

async function updateValidator(db: Db, name: string, validator: Document) {
  await db.command({
    collMod: name,
    validator,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}

export async function applyCc014BaselineSchemaEngine(db: Db): Promise<void> {
  await db
    .collection('careprograms')
    .updateMany(
      { 'baselineForm.schemaVersion': { $exists: false } },
      { $set: { 'baselineForm.schemaVersion': 'v1' } },
    );

  for await (const enrollment of db
    .collection('patientcareprograms')
    .find({ baselineSchemaVersion: { $exists: false } })) {
    const config = (enrollment.programConfig ?? {}) as Record<string, any>;
    const version =
      typeof config.baselineSchemaVersion === 'string'
        ? config.baselineSchemaVersion
        : typeof config.baselineForm?.schemaVersion === 'string'
          ? config.baselineForm.schemaVersion
          : 'v1';
    await db.collection('patientcareprograms').updateOne(
      { _id: enrollment._id },
      {
        $set: {
          baselineSchemaVersion: version,
          'programConfig.baselineSchemaVersion': version,
        },
      },
    );
  }

  for (const collection of CC014_BASELINE_SCHEMA_COLLECTIONS)
    await updateValidator(db, collection.name, collection.validator);
}
