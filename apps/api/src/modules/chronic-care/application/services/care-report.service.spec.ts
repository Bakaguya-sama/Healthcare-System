import { projectPatientHealthEvaluationSummary } from './care-report.service';

describe('CareReport Patient projection', () => {
  it('keeps aggregate severity counts but removes internal reason and evaluation identifiers', () => {
    const projection = projectPatientHealthEvaluationSummary({
      total: 2,
      bySeverity: { normal: 0, attention: 1, urgent: 1 },
      reasonCodes: ['systolic_above_urgent_threshold'],
      evaluationIds: ['evaluation-1', 'evaluation-2'],
    });

    expect(projection).toEqual({
      total: 2,
      bySeverity: { normal: 0, attention: 1, urgent: 1 },
    });
    expect(projection).not.toHaveProperty('reasonCodes');
    expect(projection).not.toHaveProperty('evaluationIds');
  });
});
