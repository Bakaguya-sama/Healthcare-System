import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_GENERATE_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 3000;

export type GenerateMedicalAnswerInput = {
  modelName: string;
  systemInstruction: string;
  history: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  userPrompt: string;
  userImages?: Array<{
    mimeType: string;
    base64Data: string;
  }>;
};

export type GenerateMedicalImageDesciptionInput = {
  modelName: string;
  systemInstruction: string;
  userImages: Array<{
    mimeType: string;
    base64Data: string;
  }>;
};

export type GenerateTopicSummaryInput = {
  modelName: string;
  text: string;
};

export type GenerateHealthMetricNotiInput = {
  modelName: string;
  metricType: string;
  metricValue: any;
  metricUnit: string;
};

export type GenerateHealthProfileSummary = {
  patientProfile: any;
  recentMetrics: any;
};

type MessagePayload =
  | string
  | Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    >;

type ChatResult = {
  response: {
    text(): string;
  };
};

type ChatClient = {
  sendMessage(request: MessagePayload): Promise<ChatResult>;
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

    const chat = model.startChat({ history: input.history }) as ChatClient;
    const messagePayload: MessagePayload =
      input.userImages && input.userImages.length > 0
        ? [
            { text: input.userPrompt },
            ...input.userImages.map((image) => ({
              inlineData: {
                mimeType: image.mimeType,
                data: image.base64Data,
              },
            })),
          ]
        : input.userPrompt;

    const result = await this.sendMessageWithRetry(chat, messagePayload);
    const text = result.response.text();

    if (!text?.trim()) {
      throw new BadRequestException('Mô hình ngôn ngữ trả về phản hồi rỗng');
    }

    return text;
  }

  async generateImageDescription(
    input: GenerateMedicalImageDesciptionInput,
  ): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: input.modelName,
    });

    const imageParts = input.userImages.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64Data,
      },
    }));

    const payload = [input.systemInstruction, ...imageParts];

    for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent(payload);
        const text = result.response.text();
        if (!text?.trim()) {
          throw new BadRequestException(
            'Mô hình ngôn ngữ trả về mô tả ảnh rỗng',
          );
        }
        return text;
      } catch (error) {
        const transient = this.isTransientProviderError(error);
        const isLastAttempt = attempt === MAX_GENERATE_ATTEMPTS;

        if (!transient || isLastAttempt) {
          this.logger.error(`[LLM Gateway] Image description error: ${error}`);
          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error) + attempt * 500;
        this.logger.warn(
          `Gemini generateContent (image) transient error, attempt ${attempt}/${MAX_GENERATE_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'AI provider (image description) retry attempts exceeded',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async generateTopicSummary(
    input: GenerateTopicSummaryInput,
  ): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: input.modelName,
    });

    const prompt = `Tóm tắt chủ đề cuộc hội thoại y tế thành 6-12 từ.
Không dùng dấu ngoặc kép, không thêm ký hiệu, không nhắc lời chào.
Chỉ trả về một dòng duy nhất.

Nội dung:
${input.text}`;

    for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text?.trim()) {
          throw new BadRequestException('Mô hình trả về tóm tắt rỗng');
        }

        return text;
      } catch (error) {
        const transient = this.isTransientProviderError(error);
        const isLastAttempt = attempt === MAX_GENERATE_ATTEMPTS;

        if (!transient || isLastAttempt) {
          this.logger.error(`[LLM Gateway] Topic summary error: ${error}`);
          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error) + attempt * 400;
        this.logger.warn(
          `Gemini generateContent (topic) transient error, attempt ${attempt}/${MAX_GENERATE_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'AI provider (topic summary) retry attempts exceeded',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async generateAINotificationAlert(
    input: GenerateHealthMetricNotiInput,
  ): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: input.modelName,
    });

    const prompt = `Bệnh nhân vừa đo ${input.metricType} đạt mức ${input.metricValue} ${input.metricUnit}. Mức này đang bị cảnh báo nguy hiểm. Viết ĐÚNG 2 câu: 1 câu giải thích nguy cơ, 1 câu khuyên họ nên làm gì ngay lúc này (không kê đơn).`;

    for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text?.trim()) {
          throw new BadRequestException('Mô hình trả về tóm tắt rỗng');
        }

        return text;
      } catch (error) {
        const transient = this.isTransientProviderError(error);
        const isLastAttempt = attempt === MAX_GENERATE_ATTEMPTS;

        if (!transient || isLastAttempt) {
          this.logger.error(
            `[LLM Gateway] Failed to generate alert notification: ${error}`,
          );
          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error) + attempt * 400;
        this.logger.warn(
          `Gemini generateContent (topic) transient error, attempt ${attempt}/${MAX_GENERATE_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'AI provider (notification) retry attempts exceeded',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async generateHealthProfileSummary(
    input: GenerateHealthProfileSummary,
  ): Promise<string> {
    const model = this.getClient().getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    });

    const prompt = `
Bạn là một Bác sĩ nội trú đang làm báo cáo tóm tắt bệnh án cho Bác sĩ điều trị. Dưới đây là dữ liệu thô của bệnh nhân:
- Tiền sử & Tổng quan: ${JSON.stringify(input.patientProfile ?? {})}
- Chỉ số sinh hiệu gần đây: ${JSON.stringify(input.recentMetrics ?? [])}

YÊU CẦU ĐỊNH DẠNG VÀ VĂN PHONG (TUYỆT ĐỐI TUÂN THỦ):
- KHÔNG nhắc đến thông tin định danh cá nhân (tên, email, số điện thoại, địa chỉ).
- Không giải thích dữ liệu đầu vào, không nhắc lại hoặc liệt kê lại toàn bộ chỉ số.
- Không xuất lại thông tin cá nhân (tên, địa chỉ, liên hệ, ...).
- SỬ DỤNG MARKDOWN: Dùng thẻ Heading 3 (###) cho 3 mục chính. Trong mỗi mục, dùng dấu gạch ngang (-) để liệt kê các ý phân tích. In đậm (**) các từ khóa, triệu chứng hoặc chỉ số quan trọng.
- VĂN PHONG: Chuyên môn y khoa, rành mạch, có chiều sâu phân tích lâm sàng (không trả lời cụt lủn 1-2 câu).

HÃY XUẤT BẢN TÓM TẮT THEO ĐÚNG 3 MỤC DƯỚI ĐÂY:

### 1. Đánh giá sức khỏe tổng quan
- Phân tích ngắn gọn tình trạng dựa trên tiền sử bệnh lý và thể trạng.
- Nêu bật các yếu tố nguy cơ tiềm ẩn cần lưu tâm (ví dụ: béo phì, tiền sử phẫu thuật, bệnh mãn tính...). 

### 2. Biến động sinh hiệu gần đây
- Chỉ chắt lọc và đánh giá các **chỉ số bất thường**. Nêu rõ mức độ chênh lệch và xu hướng (đang tăng hay giảm).
- Nếu các chỉ số bình thường hoặc không có dữ liệu, hãy ghi nhận: "Chưa ghi nhận biến động sinh hiệu bất thường" hoặc "Chưa có dữ liệu sinh hiệu mới".

### 3. Trọng tâm khai thác lâm sàng hôm nay
- Đề xuất 2-3 câu hỏi cụ thể, xoáy sâu vào tiền sử để Bác sĩ khai thác thêm (VD: Thay vì nói "Hỏi về đau đầu", hãy viết "Khai thác tính chất cơn đau đầu: tần suất, cường độ, thời điểm xuất hiện và có đáp ứng với thuốc giảm đau không?").
- Khuyến nghị chỉ định thêm cận lâm sàng (xét nghiệm, siêu âm) nếu thấy cần thiết để làm rõ chẩn đoán.
`;

    for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text?.trim()) {
          throw new BadRequestException('Mô hình trả về tóm tắt rỗng');
        }

        return text;
      } catch (error) {
        const transient = this.isTransientProviderError(error);
        const isLastAttempt = attempt === MAX_GENERATE_ATTEMPTS;

        if (!transient || isLastAttempt) {
          this.logger.error(
            `[LLM Gateway] Failed to generate health profile summary: ${error}`,
          );
          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error) + attempt * 400;
        this.logger.warn(
          `Gemini generateContent (topic) transient error, attempt ${attempt}/${MAX_GENERATE_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'AI provider (notification) retry attempts exceeded',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async sendMessageWithRetry(
    chat: ChatClient,
    userPrompt: MessagePayload,
  ): Promise<ChatResult> {
    for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
      try {
        return await chat.sendMessage(userPrompt);
      } catch (error) {
        const transient = this.isTransientProviderError(error);
        const isLastAttempt = attempt === MAX_GENERATE_ATTEMPTS;

        if (!transient || isLastAttempt) {
          if (transient) {
            const message =
              error instanceof Error
                ? error.message
                : 'Provider is temporarily unavailable';
            throw new HttpException(
              `AI provider temporarily unavailable: ${message}`,
              this.resolveHttpStatus(error),
            );
          }

          throw error;
        }

        const retryDelayMs = this.extractRetryDelayMs(error) + attempt * 400;
        this.logger.warn(
          `Gemini generateContent transient error, attempt ${attempt}/${MAX_GENERATE_ATTEMPTS}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }

    throw new HttpException(
      'AI provider retry attempts exceeded',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private isTransientProviderError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    return (
      message.includes('429') ||
      message.includes('503') ||
      lower.includes('resource exhausted') ||
      lower.includes('service unavailable') ||
      lower.includes('high demand') ||
      lower.includes('too many requests') ||
      lower.includes('quota')
    );
  }

  private resolveHttpStatus(error: unknown): HttpStatus {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('429')) {
      return HttpStatus.TOO_MANY_REQUESTS;
    }

    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  private extractRetryDelayMs(error: unknown): number {
    const message = error instanceof Error ? error.message : String(error);

    const secondsMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (secondsMatch) {
      return Math.ceil(Number(secondsMatch[1]) * 1000);
    }

    const millisMatch = message.match(/retry in\s+(\d+)ms/i);
    if (millisMatch) {
      return Number(millisMatch[1]);
    }

    return DEFAULT_RETRY_DELAY_MS;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
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
