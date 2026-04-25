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
