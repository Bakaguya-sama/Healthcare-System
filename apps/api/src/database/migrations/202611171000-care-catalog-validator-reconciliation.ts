import type { Db, Document } from 'mongodb';
import { CC000_FOUNDATION_COLLECTIONS } from './202609281000-cc000-chronic-care-foundation';
import { CC014_BASELINE_SCHEMA_COLLECTIONS } from './202609291300-cc014-baseline-schema-engine';
import { migrationChecksum } from './migration.types';

export const CARE_CATALOG_VALIDATOR_RECONCILIATION_VERSION = 202611171000;
export const CARE_CATALOG_VALIDATOR_RECONCILIATION_NAME =
  'care-catalog-validator-reconciliation';

function requiredValidator(
  collections: ReadonlyArray<{ name: string; validator: Document }>,
  name: string,
): Document {
  const collection = collections.find((item) => item.name === name);
  if (!collection) throw new Error(`Missing validator contract for ${name}`);
  return collection.validator;
}

export const CARE_PROGRAM_VALIDATOR = requiredValidator(
  CC014_BASELINE_SCHEMA_COLLECTIONS,
  'careprograms',
);

export const CARE_RULE_VALIDATOR = requiredValidator(
  CC000_FOUNDATION_COLLECTIONS,
  'carerules',
);

export const CARE_CATALOG_VALIDATOR_RECONCILIATION_CHECKSUM = migrationChecksum({
  version: CARE_CATALOG_VALIDATOR_RECONCILIATION_VERSION,
  name: CARE_CATALOG_VALIDATOR_RECONCILIATION_NAME,
  careProgramValidator: CARE_PROGRAM_VALIDATOR,
  careRuleValidator: CARE_RULE_VALIDATOR,
});

/**
 * Older deployed databases recorded the historical catalog migrations before
 * their validator contracts were refined. Migration records therefore skip the
 * old code even though the live validators no longer match the current manifest.
 * This forward-only collMod reconciles validators without rewriting documents.
 */
export async function applyCareCatalogValidatorReconciliation(
  db: Db,
): Promise<void> {
  for (const [name, validator] of [
    ['careprograms', CARE_PROGRAM_VALIDATOR],
    ['carerules', CARE_RULE_VALIDATOR],
  ] as const) {
    await db.command({
      collMod: name,
      validator,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
}
