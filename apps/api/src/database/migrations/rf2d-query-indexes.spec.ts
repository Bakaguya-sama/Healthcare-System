import { AiConversationSchema } from '../../modules/ai-advisory/domain/entities/conversations/ai-conversation.entity';
import { MessageSchema } from '../../modules/consultations/domain/entities/messaging/message.entity';
import { HealthMetricSchema } from '../../modules/health-tracking/domain/entities/health-metric.entity';
import { NotificationSchema } from '../../modules/notifications/domain/entities/notification.entity';
import { RF2D_QUERY_INDEXES } from './202609162200-rf2d-query-indexes';
import { RETIRED_AI_CONVERSATION_INDEX_NAMES } from './202609291200-schema-simplification';

describe('RF-2D index schema synchronization', () => {
  it('keeps every versioned migration index in its Mongoose schema', () => {
    const schemaIndexes = [
      ...MessageSchema.indexes(),
      ...HealthMetricSchema.indexes(),
      ...NotificationSchema.indexes(),
      ...AiConversationSchema.indexes(),
    ];
    const schemaIndexByName = new Map(
      schemaIndexes
        .filter(([, options]) => typeof options.name === 'string')
        .map(([key, options]) => [options.name, key]),
    );

    const activeRuntimeIndexes = RF2D_QUERY_INDEXES.filter(
      ({ collection, name }) =>
        collection !== 'sessions' &&
        collection !== 'doctors' &&
        // CC-006 replaces the legacy top-level HealthMetric indexes with the
        // target `meta.*` indexes and drops the old names during migration.
        collection !== 'healthmetrics' &&
        name !== 'doctorSessionId_1_sentAt_-1__id_-1' &&
        !RETIRED_AI_CONVERSATION_INDEX_NAMES.includes(
          name as (typeof RETIRED_AI_CONVERSATION_INDEX_NAMES)[number],
        ),
    );

    for (const managedIndex of activeRuntimeIndexes) {
      expect(schemaIndexByName.get(managedIndex.name)).toEqual(
        managedIndex.key,
      );
    }
  });
});
