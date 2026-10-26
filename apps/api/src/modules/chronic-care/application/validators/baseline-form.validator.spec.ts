import {
  projectBaselineAnswers,
  validateBaselineAnswers,
  validateBaselineForm,
} from './baseline-form.validator';

const hypertensionV1 = {
  schemaVersion: 'v1',
  fields: [
    {
      key: 'systolic_bp',
      type: 'integer',
      unit: 'mmHg',
      range: { min: 70, max: 250 },
      required: true,
      visibility: 'care_team',
    },
    {
      key: 'has_headache',
      type: 'boolean',
      required: false,
      visibility: 'patient',
    },
  ],
} as const;

describe('baseline schema v1', () => {
  it('accepts valid hypertension answers including range boundaries', () => {
    expect(
      validateBaselineAnswers(hypertensionV1, {
        systolic_bp: 70,
        has_headache: false,
      }),
    ).toEqual(expect.objectContaining({ valid: true }));
  });

  it('rejects missing, out-of-range and unknown answers without their values', () => {
    const missing = validateBaselineAnswers(hypertensionV1, {});
    const invalid = validateBaselineAnswers(hypertensionV1, {
      systolic_bp: 251,
      unexpected: 'private answer',
    });
    expect(missing).toEqual(
      expect.objectContaining({
        valid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'answer_required',
            field: 'systolic_bp',
          }),
        ]),
      }),
    );
    expect(invalid).toEqual(
      expect.objectContaining({
        valid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'answer_range_invalid',
            field: 'systolic_bp',
          }),
          expect.objectContaining({
            code: 'answer_unknown_field',
            field: 'unexpected',
          }),
        ]),
      }),
    );
    expect(JSON.stringify(invalid)).not.toContain('private answer');
  });

  it('rejects executable and unallowlisted schema properties', () => {
    expect(
      validateBaselineForm({
        ...hypertensionV1,
        expression: 'process.exit()',
      }),
    ).toEqual(expect.objectContaining({ valid: false }));
    expect(
      validateBaselineForm({
        ...hypertensionV1,
        fields: [{ ...hypertensionV1.fields[0], expression: 'x > 1' }],
      }),
    ).toEqual(expect.objectContaining({ valid: false }));
  });

  it('uses the enrollment snapshot rather than a newer program schema', () => {
    const diabetesV1 = {
      schemaVersion: 'v1',
      fields: [
        {
          key: 'fasting_glucose',
          type: 'number',
          unit: 'mmol/L',
          range: { min: 2, max: 30 },
          required: true,
          visibility: 'care_team',
        },
      ],
    } as const;
    expect(
      validateBaselineAnswers(hypertensionV1, { systolic_bp: 120 }),
    ).toEqual(expect.objectContaining({ valid: true }));
    expect(validateBaselineAnswers(diabetesV1, { systolic_bp: 120 })).toEqual(
      expect.objectContaining({ valid: false }),
    );
  });

  it('projects care-team-only answers away from the patient audience', () => {
    const answers = { systolic_bp: 120, has_headache: true };
    expect(projectBaselineAnswers(hypertensionV1, answers, 'patient')).toEqual({
      has_headache: true,
    });
    expect(
      projectBaselineAnswers(hypertensionV1, answers, 'care_team'),
    ).toEqual(answers);
  });
});
