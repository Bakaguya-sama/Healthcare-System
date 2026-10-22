import { AiAssistantService } from './ai-assistant.service';
import { ProviderUsageMetadataMissingException } from '../../errors/provider-usage-metadata-missing.exception';

describe('AiAssistantService quota settlement', () => {
  it('commits the aggregated provider usage returned by orchestration, not a text-length estimate', async () => {
    const quota = {
      reserve: jest.fn().mockResolvedValue({
        reservationId: '507f1f77bcf86cd799439011',
        estimatedInputTokens: 2_000,
        maxOutputTokens: 1_536,
        status: 'reserved',
      }),
      commit: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      markUsageReconciliationRequired: jest.fn().mockResolvedValue(undefined),
    };
    const orchestration = {
      sendMessage: jest.fn().mockResolvedValue({
        statusCode: 200,
        message: 'Message processed successfully',
        // Represents the final answer plus an image description/topic call.
        quotaUsage: { inputTokens: 2_417, outputTokens: 318 },
        data: { finalAiResponse: 'short reply' },
      }),
    };
    const service = new AiAssistantService(
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue('test-key') } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      {} as never,
      {} as never,
      orchestration as never,
      quota,
    );

    const result = await service.sendMessage(
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439013',
      { message: 'hello' },
      [],
      'chat-request-1',
    );

    expect(quota.commit).toHaveBeenCalledWith({
      reservationId: '507f1f77bcf86cd799439011',
      inputTokens: 2_417,
      outputTokens: 318,
    });
    expect(result).not.toHaveProperty('quotaUsage');
  });

  it('keeps the reservation for reconciliation when provider usage metadata is missing', async () => {
    const quota = {
      reserve: jest.fn().mockResolvedValue({
        reservationId: '507f1f77bcf86cd799439011',
        estimatedInputTokens: 2_000,
        maxOutputTokens: 1_536,
        status: 'reserved',
      }),
      commit: jest.fn(),
      release: jest.fn(),
      markUsageReconciliationRequired: jest.fn().mockResolvedValue(undefined),
    };
    const missingUsage = new ProviderUsageMetadataMissingException();
    const orchestration = {
      sendMessage: jest.fn().mockRejectedValue(missingUsage),
    };
    const service = new AiAssistantService(
      {} as never, {} as never,
      { get: jest.fn().mockReturnValue('test-key') } as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, undefined, undefined, undefined,
      {} as never, {} as never, orchestration as never, quota,
    );

    await expect(service.sendMessage(
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439013',
      { message: 'hello' }, [], 'chat-request-metadata-missing',
    )).rejects.toBe(missingUsage);

    expect(quota.markUsageReconciliationRequired).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'provider_usage_metadata_missing',
    );
    expect(quota.commit).not.toHaveBeenCalled();
    expect(quota.release).not.toHaveBeenCalled();
  });
});
