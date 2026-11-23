import { AiMessageOrchestrationService } from './ai-message-orchestration.service';

describe('AiMessageOrchestrationService external literature quarantine', () => {
  it('creates a review candidate but never turns unapproved PubMed metadata into patient context', async () => {
    const externalEvidence = {
      discoverCandidatesWhenInternalEvidenceIsInsufficient: jest
        .fn()
        .mockResolvedValue(1),
    };
    const service = new AiMessageOrchestrationService(
      {} as never,
      {} as never,
      {} as never,
      { retrieve: jest.fn().mockResolvedValue({ hits: [], threshold: 0.85 }) } as never,
      { build: jest.fn().mockReturnValue({ context: null, citations: [] }) } as never,
      { estimateConfidence: jest.fn().mockReturnValue(0) } as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      externalEvidence as never,
    );

    const result = await service['buildRagContext'](
      'nghiên cứu mới về tăng huyết áp',
    );

    expect(
      externalEvidence.discoverCandidatesWhenInternalEvidenceIsInsufficient,
    ).toHaveBeenCalledWith('nghiên cứu mới về tăng huyết áp', true);
    expect(result).toEqual({
      context: null,
      hasRelevantSource: false,
      citations: [],
      confidence: 0,
    });
  });
});
