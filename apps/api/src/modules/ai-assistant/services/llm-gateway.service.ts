import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_GENERATE_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 3000;

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
    const result = await this.sendMessageWithRetry(chat, input.userPrompt);
    const text = result.response.text();

    if (!text?.trim()) {
      throw new BadRequestException('Mô hình ngôn ngữ trả về phản hồi rỗng');
    }

    return text;
  }

  private async sendMessageWithRetry(
    chat: { sendMessage: (message: string) => Promise<any> },
    userPrompt: string,
  ): Promise<any> {
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
