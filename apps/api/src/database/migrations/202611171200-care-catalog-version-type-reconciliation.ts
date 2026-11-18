import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

/**
 * The catalog validator has always represented version as BSON double because
 * Mongoose Number writes a double. Older seed/import data used BSON int,
 * which has the same numeric value but cannot be restored under that
 * validator. Converting only BSON int values preserves the version exactly.
 */
export const CARE_CATALOG_VERSION_TYPE_RECONCILIATION_VERSION = 202611171200;
export const CARE_CATALOG_VERSION_TYPE_RECONCILIATION_NAME =
  'care-catalog-version-type-reconciliation';

export const CARE_CATALOG_VERSION_TYPE_RECONCILIATION_TARGETS = [
  'careprograms',
  'carerules',
] as const;

export const CARE_CATALOG_VERSION_TYPE_RECONCILIATION_CHECKSUM =
  migrationChecksum({
    version: CARE_CATALOG_VERSION_TYPE_RECONCILIATION_VERSION,
    name: CARE_CATALOG_VERSION_TYPE_RECONCILIATION_NAME,
    targets: CARE_CATALOG_VERSION_TYPE_RECONCILIATION_TARGETS,
    semantics: 'convert-bson-int-version-to-double-only',
  });

export async function applyCareCatalogVersionTypeReconciliation(
  db: Db,
): Promise<void> {
  for (const collectionName of CARE_CATALOG_VERSION_TYPE_RECONCILIATION_TARGETS)
    await db.collection(collectionName).updateMany(
      { version: { $type: 'int' } },
      [{ $set: { version: { $toDouble: '$version' } } }],
    );
}
