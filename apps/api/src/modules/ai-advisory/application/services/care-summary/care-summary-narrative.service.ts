import { Injectable } from '@nestjs/common';
import type {
  CareSummaryNarrativePort,
  CareSummaryNarrativeRequest,
} from '../../ports/care-summary/care-summary-narrative.port';
import { LlmGatewayService } from '../../../infrastructure/adapters/retrieval/llm-gateway.service';

@Injectable()
export class CareSummaryNarrativeService implements CareSummaryNarrativePort {
  constructor(private readonly llm: LlmGatewayService) {}

  async generate(input: CareSummaryNarrativeRequest): Promise<unknown> {
    const response = await this.llm.generateJson({
      modelName: 'gemini-2.5-flash-lite',
      systemInstruction:
        'Use only provided facts. Never diagnose, prescribe, change medication or severity, or claim certainty. Return only JSON with overview, observations, missingData, alertsToMention, questionsForDoctor, disclaimer. Every value must be a string or a string array.',
      prompt: JSON.stringify(input),
    });
    return JSON.parse(response) as unknown;
  }
}
