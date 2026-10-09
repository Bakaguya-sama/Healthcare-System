import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class AiSafetyService {
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
