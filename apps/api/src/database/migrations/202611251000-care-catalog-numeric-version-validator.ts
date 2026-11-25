import type { Db, Document } from 'mongodb';
import { CC000_FOUNDATION_COLLECTIONS } from './202609281000-cc000-chronic-care-foundation';
import { CC014_BASELINE_SCHEMA_COLLECTIONS } from './202609291300-cc014-baseline-schema-engine';
import { migrationChecksum } from './migration.types';

export const CARE_CATALOG_NUMERIC_VERSION_VALIDATOR_VERSION = 202611251000;
export const CARE_CATALOG_NUMERIC_VERSION_VALIDATOR_NAME =
  'care-catalog-numeric-version-validator';

function validatorWithNumericVersion(
  collections: ReadonlyArray<{ name: string; validator: Document }>,
  collectionName: string,
): Document {
  const source = collections.find((collection) => collection.name === collectionName);
  if (!source) throw new Error(`Missing ${collectionName} validator contract`);
  const jsonSchema = source.validator.$jsonSchema as Document;
  const properties = jsonSchema.properties as Document;
  const version = properties.version as Document;
  return {
    $jsonSchema: {
      ...jsonSchema,
      properties: {
        ...properties,
        version: {
          ...version,
          bsonType: ['int', 'long', 'double'],
        },
      },
    },
  };
}

export const CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR = validatorWithNumericVersion(
  CC014_BASELINE_SCHEMA_COLLECTIONS,
  'careprograms',
);
export const CARE_RULE_NUMERIC_VERSION_VALIDATOR = validatorWithNumericVersion(
  CC000_FOUNDATION_COLLECTIONS,
  'carerules',
);

export const CARE_CATALOG_NUMERIC_VERSION_VALIDATOR_CHECKSUM = migrationChecksum({
  version: CARE_CATALOG_NUMERIC_VERSION_VALIDATOR_VERSION,
  name: CARE_CATALOG_NUMERIC_VERSION_VALIDATOR_NAME,
  careProgramValidator: CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR,
  careRuleValidator: CARE_RULE_NUMERIC_VERSION_VALIDATOR,
});

/**
 * Restore the deployed numeric contract without rewriting historical CC000 or
 * converting existing records. Re-running collMod applies the same validators.
 */
export async function applyCareCatalogNumericVersionValidator(
  db: Db,
): Promise<void> {
  await db.command({
    collMod: 'careprograms',
    validator: CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR,
    validationLevel: 'strict',
    validationAction: 'error',
  });
  await db.command({
    collMod: 'carerules',
    validator: CARE_RULE_NUMERIC_VERSION_VALIDATOR,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}
