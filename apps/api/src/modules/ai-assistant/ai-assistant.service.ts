import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AskAiDto } from './dto/ask-ai.dto';

const SYSTEM_PROMPT = `Bạn là trợ lý y tế thông minh của ứng dụng HealthcareApp.
Nhiệm vụ của bạn:
- Trả lời các câu hỏi về sức khỏe, triệu chứng, và lời khuyên y tế cơ bản.
- Giải thích kết quả xét nghiệm và chỉ số sức khỏe theo cách dễ hiểu.
- Khuyến khích người dùng đặt lịch tư vấn với bác sĩ khi cần thiết.

Quy tắc bắt buộc:
- KHÔNG chẩn đoán bệnh cụ thể thay cho bác sĩ.
- KHÔNG kê đơn thuốc hoặc liều dùng.
- KHÔNG cung cấp thông tin sai lệch về y tế.
- Luôn khuyến khích tham khảo ý kiến bác sĩ cho các vấn đề nghiêm trọng.
- Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.`;

@Injectable()
export class AiAssistantService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async ask(dto: AskAiDto) {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const history = (dto.history ?? []).map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));

    const chat = model.startChat({ history });

    try {
      const result = await chat.sendMessage(dto.question);
      const response = result.response;
      return { answer: response.text() };
    } catch {
      throw new BadRequestException('AI service unavailable, please try again');
    }
  }
}
