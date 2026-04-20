import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type GenerateMedicalAnswerInput = {
  modelName: string;
  systemInstruction: string;
  history: Array<{ role: string; parts: Array<{ text: string }> }>;
  userPrompt: string;
};

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async generateMedicalAnswer(
    input: GenerateMedicalAnswerInput,
  ): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: input.modelName,
      systemInstruction: input.systemInstruction,
    });

    const chat = model.startChat({ history: input.history });
    const result = await chat.sendMessage(input.userPrompt);
    const text = result.response.text();

    if (!text?.trim()) {
      throw new BadRequestException('Mô hình ngôn ngữ trả về phản hồi rỗng');
    }

    return text;
  }

  private getClient(): GoogleGenerativeAI {
    if (this.genAI) {
      return this.genAI;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'dev_key_placeholder') {
      throw new BadRequestException(
        'Chưa cấu hình Gemini API Key. Vui lòng thiết lập GEMINI_API_KEY trong file .env và khởi động lại máy chủ.',
      );
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      return this.genAI;
    } catch (error) {
      this.logger.error('Không thể khởi tạo Gemini client', error);
      throw new BadRequestException('Không thể khởi tạo Gemini client');
    }
  }
}
