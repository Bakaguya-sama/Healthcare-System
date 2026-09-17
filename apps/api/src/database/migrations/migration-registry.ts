import {
  applyRf2dQueryIndexes,
  RF2D_QUERY_INDEX_MIGRATION_CHECKSUM,
  RF2D_QUERY_INDEX_MIGRATION_NAME,
  RF2D_QUERY_INDEX_MIGRATION_VERSION,
} from './202609162200-rf2d-query-indexes';
import type { DatabaseMigration } from './migration.types';
import {
  applyRf5CanonicalIdentity,
  RF5_CANONICAL_IDENTITY_CHECKSUM,
  RF5_CANONICAL_IDENTITY_NAME,
  RF5_CANONICAL_IDENTITY_VERSION,
} from './202609172100-rf5-canonical-identity';

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: RF2D_QUERY_INDEX_MIGRATION_VERSION,
    name: RF2D_QUERY_INDEX_MIGRATION_NAME,
    checksum: RF2D_QUERY_INDEX_MIGRATION_CHECKSUM,
    up: applyRf2dQueryIndexes,
  },
  {
    version: RF5_CANONICAL_IDENTITY_VERSION,
    name: RF5_CANONICAL_IDENTITY_NAME,
    checksum: RF5_CANONICAL_IDENTITY_CHECKSUM,
    up: applyRf5CanonicalIdentity,
  },
];

export const LATEST_SCHEMA_VERSION = Math.max(
  ...DATABASE_MIGRATIONS.map((migration) => migration.version),
);
