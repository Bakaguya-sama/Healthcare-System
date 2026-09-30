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
import {
  applyRf6Consultations,
  RF6_CONSULTATIONS_CHECKSUM,
  RF6_CONSULTATIONS_NAME,
  RF6_CONSULTATIONS_VERSION,
} from './202609182100-rf6-consultations';
import {
  applyRf7ChatReviews,
  RF7_CHAT_REVIEWS_CHECKSUM,
  RF7_CHAT_REVIEWS_NAME,
  RF7_CHAT_REVIEWS_VERSION,
} from './202609182200-rf7-chat-reviews';
import {
  applyRf8HealthAi,
  RF8_HEALTH_AI_CHECKSUM,
  RF8_HEALTH_AI_NAME,
  RF8_HEALTH_AI_VERSION,
} from './202609182300-rf8-health-ai';
import {
  applyRf8AiMessageCutover,
  RF8_AI_MESSAGE_CUTOVER_CHECKSUM,
  RF8_AI_MESSAGE_CUTOVER_NAME,
  RF8_AI_MESSAGE_CUTOVER_VERSION,
} from './202609182400-rf8-ai-message-cutover';
import {
  applyRf9Outbox,
  RF9_OUTBOX_CHECKSUM,
  RF9_OUTBOX_NAME,
  RF9_OUTBOX_VERSION,
} from './202609182500-rf9-outbox';
import {
  applyRf9AtomicNotifications,
  RF9_ATOMIC_NOTIFICATIONS_CHECKSUM,
  RF9_ATOMIC_NOTIFICATIONS_NAME,
  RF9_ATOMIC_NOTIFICATIONS_VERSION,
} from './202609182510-rf9-atomic-notifications';
import {
  applyRf10bCanonicalCleanup,
  RF10B_CANONICAL_CLEANUP_CHECKSUM,
  RF10B_CANONICAL_CLEANUP_NAME,
  RF10B_CANONICAL_CLEANUP_VERSION,
} from './202609202000-rf10b-canonical-cleanup';
import {
  applyRf10cPhysicalCleanup,
  RF10C_PHYSICAL_CLEANUP_CHECKSUM,
  RF10C_PHYSICAL_CLEANUP_NAME,
  RF10C_PHYSICAL_CLEANUP_VERSION,
} from './202609202100-rf10c-physical-cleanup';
import {
  applyCc000ChronicCareFoundation,
  CC000_CHRONIC_CARE_FOUNDATION_CHECKSUM,
  CC000_CHRONIC_CARE_FOUNDATION_NAME,
  CC000_CHRONIC_CARE_FOUNDATION_VERSION,
} from './202609281000-cc000-chronic-care-foundation';
import {
  applyCc001aCareCatalog,
  CC001A_CARE_CATALOG_CHECKSUM,
  CC001A_CARE_CATALOG_NAME,
  CC001A_CARE_CATALOG_VERSION,
} from './202609291000-cc001a-care-catalog';
import {
  applyCc001bEnrollment,
  CC001B_ENROLLMENT_CHECKSUM,
  CC001B_ENROLLMENT_NAME,
  CC001B_ENROLLMENT_VERSION,
} from './202609291100-cc001b-enrollment';
import {
  applySchemaSimplification,
  SCHEMA_SIMPLIFICATION_CHECKSUM,
  SCHEMA_SIMPLIFICATION_NAME,
  SCHEMA_SIMPLIFICATION_VERSION,
} from './202609291200-schema-simplification';
import {
  applyCc014BaselineSchemaEngine,
  CC014_BASELINE_SCHEMA_ENGINE_CHECKSUM,
  CC014_BASELINE_SCHEMA_ENGINE_NAME,
  CC014_BASELINE_SCHEMA_ENGINE_VERSION,
} from './202609291300-cc014-baseline-schema-engine';
import {
  applyCc014RemoveRedundantBaselineVersion,
  CC014_REMOVE_REDUNDANT_BASELINE_VERSION,
  CC014_REMOVE_REDUNDANT_BASELINE_VERSION_CHECKSUM,
  CC014_REMOVE_REDUNDANT_BASELINE_VERSION_NAME,
} from './202609300900-cc014-remove-redundant-baseline-version';
import {
  applyCc002CareTasks,
  CC002_CARE_TASKS_CHECKSUM,
  CC002_CARE_TASKS_NAME,
  CC002_CARE_TASKS_VERSION,
} from './202609301000-cc002-care-tasks';

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
  {
    version: RF6_CONSULTATIONS_VERSION,
    name: RF6_CONSULTATIONS_NAME,
    checksum: RF6_CONSULTATIONS_CHECKSUM,
    up: applyRf6Consultations,
  },
  {
    version: RF7_CHAT_REVIEWS_VERSION,
    name: RF7_CHAT_REVIEWS_NAME,
    checksum: RF7_CHAT_REVIEWS_CHECKSUM,
    up: applyRf7ChatReviews,
  },
  {
    version: RF8_HEALTH_AI_VERSION,
    name: RF8_HEALTH_AI_NAME,
    checksum: RF8_HEALTH_AI_CHECKSUM,
    up: applyRf8HealthAi,
  },
  {
    version: RF8_AI_MESSAGE_CUTOVER_VERSION,
    name: RF8_AI_MESSAGE_CUTOVER_NAME,
    checksum: RF8_AI_MESSAGE_CUTOVER_CHECKSUM,
    up: applyRf8AiMessageCutover,
  },
  {
    version: RF9_OUTBOX_VERSION,
    name: RF9_OUTBOX_NAME,
    checksum: RF9_OUTBOX_CHECKSUM,
    up: applyRf9Outbox,
  },
  {
    version: RF9_ATOMIC_NOTIFICATIONS_VERSION,
    name: RF9_ATOMIC_NOTIFICATIONS_NAME,
    checksum: RF9_ATOMIC_NOTIFICATIONS_CHECKSUM,
    up: applyRf9AtomicNotifications,
  },
  {
    version: RF10B_CANONICAL_CLEANUP_VERSION,
    name: RF10B_CANONICAL_CLEANUP_NAME,
    checksum: RF10B_CANONICAL_CLEANUP_CHECKSUM,
    up: applyRf10bCanonicalCleanup,
  },
  {
    version: RF10C_PHYSICAL_CLEANUP_VERSION,
    name: RF10C_PHYSICAL_CLEANUP_NAME,
    checksum: RF10C_PHYSICAL_CLEANUP_CHECKSUM,
    up: applyRf10cPhysicalCleanup,
  },
  {
    version: CC000_CHRONIC_CARE_FOUNDATION_VERSION,
    name: CC000_CHRONIC_CARE_FOUNDATION_NAME,
    checksum: CC000_CHRONIC_CARE_FOUNDATION_CHECKSUM,
    up: applyCc000ChronicCareFoundation,
  },
  {
    version: CC001A_CARE_CATALOG_VERSION,
    name: CC001A_CARE_CATALOG_NAME,
    checksum: CC001A_CARE_CATALOG_CHECKSUM,
    up: applyCc001aCareCatalog,
  },
  {
    version: CC001B_ENROLLMENT_VERSION,
    name: CC001B_ENROLLMENT_NAME,
    checksum: CC001B_ENROLLMENT_CHECKSUM,
    up: applyCc001bEnrollment,
  },
  {
    version: SCHEMA_SIMPLIFICATION_VERSION,
    name: SCHEMA_SIMPLIFICATION_NAME,
    checksum: SCHEMA_SIMPLIFICATION_CHECKSUM,
    up: applySchemaSimplification,
  },
  {
    version: CC014_BASELINE_SCHEMA_ENGINE_VERSION,
    name: CC014_BASELINE_SCHEMA_ENGINE_NAME,
    checksum: CC014_BASELINE_SCHEMA_ENGINE_CHECKSUM,
    up: applyCc014BaselineSchemaEngine,
  },
  {
    version: CC014_REMOVE_REDUNDANT_BASELINE_VERSION,
    name: CC014_REMOVE_REDUNDANT_BASELINE_VERSION_NAME,
    checksum: CC014_REMOVE_REDUNDANT_BASELINE_VERSION_CHECKSUM,
    up: applyCc014RemoveRedundantBaselineVersion,
  },
  {
    version: CC002_CARE_TASKS_VERSION,
    name: CC002_CARE_TASKS_NAME,
    checksum: CC002_CARE_TASKS_CHECKSUM,
    up: applyCc002CareTasks,
  },
];

export const LATEST_SCHEMA_VERSION = Math.max(
  ...DATABASE_MIGRATIONS.map((migration) => migration.version),
);
