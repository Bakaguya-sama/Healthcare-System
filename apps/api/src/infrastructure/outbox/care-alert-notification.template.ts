import { NotificationType } from '../../modules/notifications/domain/entities/notification.entity';

export function renderCareAlertNotification(input: {
  severity: 'attention' | 'urgent';
}): { type: NotificationType; title: string; message: string } {
  if (input.severity === 'urgent')
    return {
      type: NotificationType.CRITICAL,
      title: 'Cần chú ý sức khỏe ngay',
      message:
        'Một hoạt động theo dõi cần được chú ý ngay. Đây không phải chẩn đoán. Nếu bạn có triệu chứng nghiêm trọng hoặc cảm thấy không an toàn, hãy liên hệ dịch vụ cấp cứu hoặc cơ sở y tế phù hợp tại địa phương.',
    };
  return {
    type: NotificationType.WARNING,
    title: 'Có hoạt động theo dõi cần chú ý',
    message:
      'Một hoạt động theo dõi cần được xem lại. Đây không phải chẩn đoán. Hãy xem chi tiết trong ứng dụng hoặc liên hệ chuyên gia y tế nếu bạn có triệu chứng đáng lo ngại.',
  };
}
