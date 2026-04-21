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
- Ngắn gọn, sử dụng gạch đầu dòng hoặc in đậm để dễ đọc.

GUYÊN TẮC KIỂM DUYỆT THUỐC ĐẶC TRỊ (CRITICAL SAFETY):
- Nếu người dùng yêu cầu kê đơn thuốc, xin thuốc, hoặc hỏi uống thuốc gì để chữa bệnh: Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC trích dẫn, liệt kê tên các loại kháng sinh, thuốc kê đơn, hoặc liều lượng (ví dụ: Penicillin, Amoxicillin, Cephalosporin...) có trong [Context].
- Bạn chỉ được phép nhắc đến các loại thuốc không kê đơn để giảm nhẹ triệu chứng thông thường (như Paracetamol để hạ sốt/giảm đau) hoặc các biện pháp không dùng thuốc (súc miệng nước muối, uống nước ấm).
- Thay vì liệt kê tên thuốc trong tài liệu, hãy tóm tắt chung chung bằng câu: "Tài liệu y khoa có đề cập đến các phác đồ sử dụng kháng sinh hoặc thuốc kháng viêm, tuy nhiên việc lựa chọn loại thuốc cụ thể bắt buộc phải do bác sĩ chỉ định sau khi thăm khám."
`;

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

  async buildDynamicTriagePrompt(userMessage: string): Promise<string> {
    /**
     * Triage Prompt Linh Hoạt - Từ cứng nhắc sang chuyên gia
     * Thay vì ép buộc AI phải hỏi 2-3 câu, hãy cho phép AI
     * tự quyết định khi nào cần hỏi dựa trên thông tin người dùng cung cấp
     */
    return `Người dùng đang mô tả tình trạng sức khỏe cá nhân: "${userMessage}".

Hãy đóng vai Trợ lý Y tế Sơ bộ (Triage Assistant) với tuân thủ các nguyên tắc sau:

**Nguyên tắc Quyết định:**
1. NẾU thông tin người dùng cung cấp ĐỦ RÕ RÀNG để hiểu tình trạng, hãy:
   - Thể hiện sự thấu cảm với triệu chứng họ đang gặp.
   - Đưa ra nhận định sơ bộ dựa trên kiến thức y khoa của bạn.
   - Gợi ý các biện pháp giảm nhẹ an toàn (uống nước, nghỉ ngơi, chườm nóng/lạnh...).
   - Nhắc nhở: "Để chẩn đoán chính xác, bạn nên tham khảo ý kiến bác sĩ chuyên khoa."

2. NẾU thông tin VẪN CHƯA ĐỦ MỌI MĐ hoặc KHÔNG RÕ, hãy:
   - Đặt CÓ CHỌN LỌC câu hỏi thiết yếu.
   - Ví dụ: "Triệu chứng này bắt đầu từ bao lâu?" hoặc "Có kèm sốt không?"
   - Sau đó, vẫn đưa ra hướng dẫn tạm thời dựa trên triệu chứng đã nêu.

3. TUYỆT ĐỐI KHÔNG:
   - Chẩn đoán bệnh cụ thể hay kê đơn thuốc.
   - Gây lo lắng không cần thiết bằng cách liệt kê các bệnh nguy hiểm.
   - Hỏi quá nhiều câu làm người dùng cảm thấy bị "thẩm vấn".

**Giọng điệu:**
- Chuyên nghiệp, thấu cảm, lịch sự.
- Hành động như một "đồng tình viên" hơn là một cái máy hỏi.`;
  }
}
