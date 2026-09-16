import { AiConversationSchema } from '../../modules/ai-assistant/entities/ai-conversation.entity';
import { MessageSchema } from '../../modules/chat/entities/message.entity';
import { HealthMetricSchema } from '../../modules/health-metrics/entities/health-metric.entity';
import { NotificationSchema } from '../../modules/notifications/entities/notification.entity';
import { SessionSchema } from '../../modules/sessions/entities/session.entity';
import { DoctorSchema } from '../../modules/users/entities/doctor.schema';
import { RF2D_QUERY_INDEXES } from './202609162200-rf2d-query-indexes';

describe('RF-2D index schema synchronization', () => {
  it('keeps every versioned migration index in its Mongoose schema', () => {
    const schemaIndexes = [
      ...DoctorSchema.indexes(),
      ...SessionSchema.indexes(),
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

    for (const managedIndex of RF2D_QUERY_INDEXES) {
      expect(schemaIndexByName.get(managedIndex.name)).toEqual(
        managedIndex.key,
      );
    }
  });
});
