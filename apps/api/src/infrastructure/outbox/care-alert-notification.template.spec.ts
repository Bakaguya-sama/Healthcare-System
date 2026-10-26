import { NotificationType } from '../../modules/notifications/domain/entities/notification.entity';
import { renderCareAlertNotification } from './care-alert-notification.template';

describe('care alert notification templates', () => {
  it('uses an approved non-diagnostic urgent template', () => {
    const notification = renderCareAlertNotification({ severity: 'urgent' });
    expect(notification.type).toBe(NotificationType.CRITICAL);
    expect(notification.message).toContain('không phải chẩn đoán');
    expect(notification.message).not.toMatch(/mg|liều|thuốc/i);
  });
});
