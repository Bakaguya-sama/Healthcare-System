import {
  createDeterministicCareSummary,
  isNumericallyGrounded,
  validateCareSummaryContent,
} from './care-summary-content';

describe('CareSummary content guard', () => {
  it('rejects a prescription-like claim', () => {
    expect(
      validateCareSummaryContent({
        overview: 'You should stop taking medication.',
        observations: [],
        missingData: [],
        alertsToMention: [],
        questionsForDoctor: [],
        disclaimer: 'Informational only.',
      }),
    ).toEqual({
      valid: false,
      reasonCodes: ['summary_safety_forbidden_claim'],
    });
  });

  it('creates a fact-free fallback when narrative generation is unavailable', () => {
    expect(
      createDeterministicCareSummary({ audience: 'patient', missingData: [{}] })
        .missingData,
    ).toHaveLength(1);
  });

  it('rejects narrative numbers that are absent from report facts', () => {
    const content = createDeterministicCareSummary({
      audience: 'patient',
      missingData: [],
    });
    content.overview = 'The value is 120.';
    expect(
      isNumericallyGrounded(content, { statistics: { systolic: 118 } }),
    ).toBe(false);
  });
});
