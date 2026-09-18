import { Injectable } from '@nestjs/common';
import {
  GenerateHealthMetricNotiInput,
  GenerateHealthProfileSummary,
  GenerateMedicalAnswerInput,
  GenerateMedicalImageDesciptionInput,
  GenerateTopicSummaryInput,
  LlmGatewayService,
} from './llm-gateway.service';

/** Application boundary around the provider gateway; domain code never imports Gemini. */
@Injectable()
export class AiResponseOrchestrator {
  constructor(private readonly llmGateway: LlmGatewayService) {}

  generateMedicalAnswer(input: GenerateMedicalAnswerInput) { return this.llmGateway.generateMedicalAnswer(input); }
  generateImageDescription(input: GenerateMedicalImageDesciptionInput) { return this.llmGateway.generateImageDescription(input); }
  generateTopicSummary(input: GenerateTopicSummaryInput) { return this.llmGateway.generateTopicSummary(input); }
  generateAINotificationAlert(input: GenerateHealthMetricNotiInput) { return this.llmGateway.generateAINotificationAlert(input); }
  generateHealthProfileSummary(input: GenerateHealthProfileSummary) { return this.llmGateway.generateHealthProfileSummary(input); }
}
