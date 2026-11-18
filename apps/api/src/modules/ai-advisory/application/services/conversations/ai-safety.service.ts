import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AiSafetyService {
  decideAnswerSafety(message: string): {
    allowRag: boolean;
    response?: string;
    reason?: 'emergency' | 'prescription';
  } {
    const normalized = message.toLowerCase();
    if (
      /(khó thở|dau ngực|đau ngực|bất tỉnh|co giật|chảy máu nhiều|tự sát)/.test(
        normalized,
      )
    )
      return {
        allowRag: false,
        reason: 'emergency',
        response:
          'Dấu hiệu bạn mô tả có thể cần cấp cứu. Hãy gọi cấp cứu hoặc đến cơ sở y tế gần nhất ngay; không chờ tư vấn trực tuyến.',
      };
    if (
      /(kê đơn|liều thuốc|uống bao nhiêu|tăng liều|giảm liều)/.test(normalized)
    )
      return {
        allowRag: false,
        reason: 'prescription',
        response:
          'Tôi không thể kê đơn hoặc hướng dẫn thay đổi liều thuốc. Hãy liên hệ bác sĩ hoặc dược sĩ đang điều trị cho bạn.',
      };
    return { allowRag: true };
  }

  normalizeUserMessage(message?: string): string {
    const normalized = message?.trim() ?? '';
    if (normalized.length > 2000)
      throw new BadRequestException('Message is too long');
    return normalized;
  }

  assertPromptBudget(message: string): void {
    if (message.length > 2000)
      throw new BadRequestException('Message is too long');
  }
}
