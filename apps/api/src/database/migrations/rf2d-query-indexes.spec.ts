import { AiConversationSchema } from '../../modules/ai-advisory/conversations/entities/ai-conversation.entity';
import { MessageSchema } from '../../modules/consultations/messaging/entities/message.entity';
import { HealthMetricSchema } from '../../modules/health-tracking/entities/health-metric.entity';
import { NotificationSchema } from '../../modules/notifications/entities/notification.entity';
import { RF2D_QUERY_INDEXES } from './202609162200-rf2d-query-indexes';

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
        name !== 'doctorSessionId_1_sentAt_-1__id_-1',
    );

    for (const managedIndex of activeRuntimeIndexes) {
      expect(schemaIndexByName.get(managedIndex.name)).toEqual(
        managedIndex.key,
      );
    }
  });
});
