import { validateBaselineForm } from '../../application/validators/baseline-form.validator';
import { evaluateCareRules } from '../rules/care-rule-interpreter';
import { validateCareTaskTemplates } from '../tasks/care-task-template.validator';
import { STANDARD_CARE_PROGRAMS } from './standard-care-programs';

describe('standard care programs', () => {
  it('keeps hypertension and diabetes as valid data configurations', () => {
    expect(
      STANDARD_CARE_PROGRAMS.map((program) => program.programCode),
    ).toEqual(['demo-hypertension', 'demo-diabetes']);
    for (const program of STANDARD_CARE_PROGRAMS) {
      expect(validateBaselineForm(program.baselineForm)).toEqual(
        expect.objectContaining({ valid: true }),
      );
      expect(validateCareTaskTemplates(program.taskTemplates)).not.toBeNull();
    }
  });

  it('uses the same rule interpreter for different metric shapes', () => {
    const hypertension = STANDARD_CARE_PROGRAMS[0];
    const diabetes = STANDARD_CARE_PROGRAMS[1];
    expect(evaluateCareRules(hypertension.rules, { systolic: 180 })).toEqual(
      expect.objectContaining({
        severity: 'urgent',
        reasonCodes: ['systolic_elevated', 'systolic_urgent'],
      }),
    );
    expect(evaluateCareRules(diabetes.rules, { value: 250 })).toEqual(
      expect.objectContaining({
        severity: 'urgent',
        reasonCodes: ['glucose_elevated', 'glucose_urgent'],
      }),
    );
  });
});
