import type { NotificationType } from "../components/ui/noti-detail-card";

export type BackendThresholdNotification = {
  title: string;
  message: string;
};

export type FriendlyThresholdNotification = {
  title: string;
  message: string;
  detail: string;
  type: NotificationType;
  primaryActionLabel?: string;
};

const METRIC_LABELS: Record<string, string> = {
  blood_pressure: "Huyết áp",
  heart_rate: "Nhịp tim",
  blood_glucose: "Đường huyết",
  oxygen_saturation: "Độ bão hòa oxy",
  body_temperature: "Nhiệt độ cơ thể",
  respiratory_rate: "Nhịp thở",
  bmi: "BMI",
  water_intake: "Lượng nước uống",
  kcal_intake: "Calo nạp vào",
};

const STATUS_MESSAGE_BY_KEYWORD: Array<{
  keyword: string;
  messageBuilder: (metricLabel: string) => string;
}> = [
  {
    keyword: "below recommended",
    messageBuilder: (metricLabel) =>
      `${metricLabel} đang thấp hơn mức khuyến nghị. Bạn nên bổ sung thêm để đảm bảo sức khỏe.`,
  },
  {
    keyword: "above recommended",
    messageBuilder: (metricLabel) =>
      `${metricLabel} đang vượt mức khuyến nghị. Bạn nên điều chỉnh lại để an toàn hơn.`,
  },
  {
    keyword: "below maintenance range",
    messageBuilder: (metricLabel) =>
      `${metricLabel} đang thấp hơn mức duy trì. Bạn nên bổ sung thêm trong ngày.`,
  },
  {
    keyword: "above maintenance range",
    messageBuilder: (metricLabel) =>
      `${metricLabel} đang vượt mức duy trì. Bạn nên giảm bớt để cân bằng hơn.`,
  },
];

function toNotificationType(title: string): NotificationType {
  const normalized = title.toLowerCase();

  if (normalized.includes("critical")) {
    return "critical";
  }

  return "warning";
}

function extractMetricType(title: string, message: string): string | null {
  const titleMatch = title.match(/critical\s+([a-z_]+)\s+alert/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].toLowerCase();
  }

  const messageMatch = message.match(
    /:\s*([a-z_]+)\s+is\s+outside\s+safe\s+threshold\.?/i,
  );
  if (messageMatch?.[1]) {
    return messageMatch[1].toLowerCase();
  }

  return null;
}

function toFriendlyMetricLabel(metricType: string | null): string {
  if (!metricType) {
    return "Chỉ số sức khỏe";
  }

  return METRIC_LABELS[metricType] ?? metricType.replaceAll("_", " ");
}

function buildFriendlyMessage(metricLabel: string, message: string): string {
  const normalizedMessage = message.toLowerCase();

  for (const statusTemplate of STATUS_MESSAGE_BY_KEYWORD) {
    if (normalizedMessage.includes(statusTemplate.keyword)) {
      return statusTemplate.messageBuilder(metricLabel);
    }
  }

  return `${metricLabel} đang nằm ngoài ngưỡng an toàn. Bạn vui lòng theo dõi và điều chỉnh sớm.`;
}

export function presentThresholdNotification(
  notification: BackendThresholdNotification,
): FriendlyThresholdNotification {
  const metricType = extractMetricType(
    notification.title,
    notification.message,
  );
  const metricLabel = toFriendlyMetricLabel(metricType);
  const friendlyMessage = buildFriendlyMessage(
    metricLabel,
    notification.message,
  );

  return {
    title: `Cảnh báo ${metricLabel}`,
    message: friendlyMessage,
    detail: `${friendlyMessage}\n`,
    type: toNotificationType(notification.title),
    primaryActionLabel: "Xem chi tiết",
  };
}
