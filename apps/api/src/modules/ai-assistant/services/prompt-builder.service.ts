import { Injectable } from '@nestjs/common';
import {
  ConversationMessage,
  MessageRole,
} from '../entities/ai-conversation.entity';
import { BlacklistKeywordsService } from '../../blacklist-keywords/blacklist-keywords.service';
import { IPromptBuilder } from '../interfaces/prompt-buidler.interface';

const SYSTEM_PROMPT = `Bạn là Trợ lý Y tế Thông minh của ứng dụng HealthcareApp.

MỤC TIÊU CỐT LÕI:
- Giải đáp thắc mắc về sức khỏe, triệu chứng và đọc hiểu chỉ số xét nghiệm.
- Ưu tiên sử dụng "Tài liệu y khoa tham khảo" được cung cấp để trả lời. Nếu không có tài liệu, hãy từ chối trả lời.
- Nếu triệu chứng hay câu hỏi của người dùng mơ hồ, không chứa nhiều dữ kiện thì HÃY ĐẶT CÁC CÂU HỎI LÀM RÕ VẤN ĐỀ CỦA NGƯỜI DÙNG.
- TỪ CHỐI trả lời mọi chủ đề không liên quan đến y tế/sức khỏe.

QUY TẮC AN TOÀN (BẮT BUỘC):
1. KHÔNG chẩn đoán xác định bệnh thay cho bác sĩ.
2. KHÔNG kê đơn thuốc, liều lượng hoặc phác đồ điều trị.
3. LUÔN thêm câu cảnh báo với tình trạng bệnh nhân nguy hiểm: "Đây chỉ là tư vấn tham khảo. Hãy đến ngay cơ sở y tế để được bác sĩ thăm khám trực tiếp."

ĐỊNH DẠNG:
- Trả lời bằng tiếng Việt có dấu, giọng điệu chuyên nghiệp, thấu cảm và lịch sự.
- Ngắn gọn, sử dụng gạch đầu dòng hoặc in đậm để dễ đọc.`;

@Injectable()
export class PromptBuilderService implements IPromptBuilder {
  constructor(private blacklistKeywordsService: BlacklistKeywordsService) {}

  private async getBlacklistWord(): Promise<string> {
    const list = await this.blacklistKeywordsService.findAll({
      page: 1,
      limit: 100,
      search: '',
      sortBy: 'createdAt',
      sortOrder: -1,
    });

    if (list.data.length === 0) return '';

    return list.data
      .map((item) => item.keyword?.trim())
      .filter((keyword): keyword is string => Boolean(keyword))
      .map((keyword) => `- ${keyword}`)
      .join('\n');
  }

  async getSystemPrompt(): Promise<string> {
    let myPrompt = SYSTEM_PROMPT;
    const blacklistText = await this.getBlacklistWord();

    if (!blacklistText) {
      return myPrompt;
    }

    myPrompt =
      myPrompt +
      '\n\nCẤM TỪ NGỮ HOẶC CÂU CÓ CHỨA CÁC TỪ, Ý NGHĨA SAU:\n' +
      blacklistText;
    return myPrompt;
  }

  buildChatHistory(
    messages: ConversationMessage[],
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages.map((message) => ({
      role:
        message.role === MessageRole.ASSISTANT ||
        message.role.toString() === 'assistant'
          ? 'model'
          : 'user',
      parts: [{ text: message.content }],
    }));
  }

  buildUserPrompt(input: {
    question: string;
    ragContext: string | null;
  }): string {
    if (!input.ragContext) {
      return input.question;
    }

    return `${input.question}\n\n${input.ragContext}\n\nHướng dẫn: Chỉ sử dụng thông tin tham khảo nếu phù hợp và không mâu thuẫn với quy tắc an toàn y tế. Nếu không đủ thông tin thì phải nói rõ là chưa đủ cơ sở để kết luận.`;
  }
}
