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
import { applyRf9Outbox, RF9_OUTBOX_CHECKSUM, RF9_OUTBOX_NAME, RF9_OUTBOX_VERSION } from './202609182500-rf9-outbox';
import { applyRf9AtomicNotifications, RF9_ATOMIC_NOTIFICATIONS_CHECKSUM, RF9_ATOMIC_NOTIFICATIONS_NAME, RF9_ATOMIC_NOTIFICATIONS_VERSION } from './202609182510-rf9-atomic-notifications';

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
  { version: RF9_OUTBOX_VERSION, name: RF9_OUTBOX_NAME, checksum: RF9_OUTBOX_CHECKSUM, up: applyRf9Outbox },
  { version: RF9_ATOMIC_NOTIFICATIONS_VERSION, name: RF9_ATOMIC_NOTIFICATIONS_NAME, checksum: RF9_ATOMIC_NOTIFICATIONS_CHECKSUM, up: applyRf9AtomicNotifications },
];

export const LATEST_SCHEMA_VERSION = Math.max(
  ...DATABASE_MIGRATIONS.map((migration) => migration.version),
);
