import { CareContentDisplayType } from '../entities/care-content.entity';
import { CareTaskType } from '../entities/care-task.entity';
import { validateCareRuleDataSources } from '../rules/care-rule-data-source.validator';
import type { CareRuleNode } from '../rules/care-rule-interpreter';
import { validateCareTaskTemplates } from './care-task-template.validator';

describe('CareTask policy v1 contracts', () => {
  const schedule = { frequency: 'daily' as const, time: '08:00', windowMinutes: 60 };

  it('accepts the versioned check-in and immutable education template contracts', () => {
    expect(
      validateCareTaskTemplates([
        {
          key: 'daily_check_in',
          type: CareTaskType.CHECK_IN,
          schedule,
          completionRule: {
            responseMode: 'health_check_in',
            schemaVersion: 'health-check-in.v1',
            allowedSymptomCodes: ['dizziness', 'headache'],
          },
        },
        {
          key: 'salt_education',
          type: CareTaskType.EDUCATION,
          schedule,
          completionRule: { responseMode: 'acknowledge' },
          contentRef: {
            contentId: 'salt_education',
            version: '1.0.0',
            locale: 'vi-VN',
            displayType: CareContentDisplayType.ARTICLE,
          },
        },
      ]),
    ).not.toBeNull();
  });

  it('fails closed for unbounded check-in codes or mutable education content', () => {
    expect(
      validateCareTaskTemplates([
        {
          key: 'daily_check_in',
          type: CareTaskType.CHECK_IN,
          schedule,
          completionRule: {
            responseMode: 'health_check_in',
            schemaVersion: 'health-check-in.v1',
            allowedSymptomCodes: ['free text'],
          },
        },
      ]),
    ).toBeNull();
    expect(
      validateCareTaskTemplates([
        {
          key: 'education',
          type: CareTaskType.EDUCATION,
          schedule,
          completionRule: { responseMode: 'acknowledge' },
          contentRef: {
            contentId: 'https://untrusted.example',
            version: 'latest',
            locale: 'vi-VN',
            displayType: 'article',
          },
        },
      ]),
    ).toBeNull();
  });

  it('allows check-in facts only through an explicit mapped template source', () => {
    const templates = validateCareTaskTemplates([
      {
        key: 'daily_check_in',
        type: CareTaskType.CHECK_IN,
        schedule,
        completionRule: {
          responseMode: 'health_check_in',
          schemaVersion: 'health-check-in.v1',
          allowedSymptomCodes: ['dizziness'],
        },
      },
    ])!;
    const rules: CareRuleNode[] = [
      {
        operator: 'equal',
        key: 'check_in.severity',
        value: 'severe',
        severity: 'urgent',
      },
    ];
    expect(
      validateCareRuleDataSources(rules, [
        {
          kind: 'care_task_check_in',
          schemaVersion: 'health-check-in.v1',
          templateKey: 'daily_check_in',
          allowedFactPrefixes: ['check_in.severity'],
        },
      ], templates),
    ).toBe(true);
    expect(validateCareRuleDataSources(rules, [], templates)).toBe(false);
  });
});
