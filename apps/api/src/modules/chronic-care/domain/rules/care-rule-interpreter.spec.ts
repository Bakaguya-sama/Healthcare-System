import { evaluateCareRules } from './care-rule-interpreter';

describe('evaluateCareRules', () => {
  const rules = [
    { operator: 'gte' as const, key: 'systolic', value: 140, severity: 'attention' as const, reasonCode: 'bp_high' },
    { operator: 'gte' as const, key: 'systolic', value: 180, severity: 'urgent' as const, reasonCode: 'bp_critical' },
  ];

  it('uses deterministic boundary comparisons and preserves reason codes', () => {
    expect(evaluateCareRules(rules, { systolic: 140 })).toEqual({
      severity: 'attention', reasonCodes: ['bp_high'], inputKeys: ['systolic'],
    });
  });

  it('returns normal for missing data and does not infer a severity', () => {
    expect(evaluateCareRules(rules, {})).toEqual({
      severity: 'normal', reasonCodes: [], inputKeys: [],
    });
  });

  it('selects the highest matched severity for repeated facts', () => {
    expect(evaluateCareRules(rules, { systolic: 180 })).toEqual({
      severity: 'urgent', reasonCodes: ['bp_high', 'bp_critical'], inputKeys: ['systolic'],
    });
  });
});
