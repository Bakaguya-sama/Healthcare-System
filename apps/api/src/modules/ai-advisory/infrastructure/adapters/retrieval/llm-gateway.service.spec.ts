import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from './llm-gateway.service';
import { ProviderUsageMetadataMissingException } from '../../../application/errors/provider-usage-metadata-missing.exception';

describe('LlmGatewayService usage settlement contract', () => {
  const input = {
    modelName: 'gemini-2.5-flash-lite',
    systemInstruction: 'Be concise.',
    history: [],
    userPrompt: 'How should I prepare for a blood test?',
  };

  it('returns Gemini-reported token usage with the generated text', async () => {
    const service = new LlmGatewayService({ get: jest.fn() } as unknown as ConfigService);
    const generateContent = jest.fn().mockResolvedValue({
      text: 'Follow your clinician instructions.',
      usageMetadata: { promptTokenCount: 123, candidatesTokenCount: 45 },
    });
    (service as unknown as { getClient: () => unknown }).getClient = () => ({
      models: { generateContent },
    });

    await expect(service.generateMedicalAnswer(input)).resolves.toEqual({
      text: 'Follow your clinician instructions.',
      usage: { inputTokens: 123, outputTokens: 45 },
    });
  });

  it('fails closed when Gemini omits usage metadata', async () => {
    const service = new LlmGatewayService({ get: jest.fn() } as unknown as ConfigService);
    (service as unknown as { getClient: () => unknown }).getClient = () => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: 'A response without billable usage.',
        }),
      },
    });

    await expect(service.generateMedicalAnswer(input)).rejects.toBeInstanceOf(
      ProviderUsageMetadataMissingException,
    );
  });

  it.each([
    [
      'image description',
      (service: LlmGatewayService) =>
        service.generateImageDescription({
          modelName: 'gemini-2.5-flash-lite',
          systemInstruction: 'Describe the medical image.',
          userImages: [{ mimeType: 'image/png', base64Data: 'image-data' }],
        }),
    ],
    [
      'topic summary',
      (service: LlmGatewayService) =>
        service.generateTopicSummary({
          modelName: 'gemini-2.5-flash-lite',
          text: 'A deliberately long conversation subject that needs a short title.',
        }),
    ],
  ])('fails closed for %s when Gemini omits usage metadata', async (_, call) => {
    const service = new LlmGatewayService({ get: jest.fn() } as unknown as ConfigService);
    (service as unknown as { getClient: () => unknown }).getClient = () => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: 'Text without billable usage metadata.',
        }),
      },
    });

    await expect(call(service)).rejects.toBeInstanceOf(
      ProviderUsageMetadataMissingException,
    );
  });
});
