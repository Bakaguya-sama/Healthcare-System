import { CareTaskType } from '../entities/care-task.entity';
import type { CareRuleNode } from '../rules/care-rule-interpreter';
import type { CareTaskTemplate } from '../tasks/care-task-template.validator';

/**
 * Versioned, data-only examples used by the local catalog seed and reuse tests.
 * They deliberately contain no disease-specific executable code: the generic
 * enrollment, task scheduler, rule interpreter, evaluation and report services
 * consume these fields exactly as they consume any other care program.
 */
export type StandardCareProgram = {
  programCode: string;
  name: string;
  diseaseKey: string;
  baselineForm: Record<string, unknown>;
  taskTemplates: CareTaskTemplate[];
  rules: CareRuleNode[];
};

export const STANDARD_CARE_PROGRAMS: readonly StandardCareProgram[] = [
  {
    programCode: 'demo-hypertension',
    name: 'Demo hypertension care program',
    diseaseKey: 'hypertension',
    baselineForm: {
      schemaVersion: 'v1',
      fields: [
        {
          key: 'usual_systolic',
          type: 'number',
          unit: 'mmHg',
          range: { min: 50, max: 300 },
          required: true,
          visibility: 'care_team',
        },
        {
          key: 'usual_diastolic',
          type: 'number',
          unit: 'mmHg',
          range: { min: 30, max: 200 },
          required: true,
          visibility: 'care_team',
        },
      ],
    },
    taskTemplates: [
      {
        key: 'morning_blood_pressure',
        type: CareTaskType.METRIC,
        required: true,
        schedule: { frequency: 'daily', time: '07:00', windowMinutes: 120 },
        completionRule: { metricType: 'blood_pressure' },
        reminderPolicy: { channels: ['in_app'] },
      },
    ],
    rules: [
      {
        operator: 'gte',
        key: 'systolic',
        value: 140,
        severity: 'attention',
        reasonCode: 'systolic_elevated',
      },
      {
        operator: 'gte',
        key: 'systolic',
        value: 180,
        severity: 'urgent',
        reasonCode: 'systolic_urgent',
      },
    ],
  },
  {
    programCode: 'demo-diabetes',
    name: 'Demo diabetes care program',
    diseaseKey: 'diabetes',
    baselineForm: {
      schemaVersion: 'v1',
      fields: [
        {
          key: 'usual_fasting_glucose',
          type: 'number',
          unit: 'mg/dL',
          range: { min: 20, max: 600 },
          required: true,
          visibility: 'care_team',
        },
      ],
    },
    taskTemplates: [
      {
        key: 'morning_blood_glucose',
        type: CareTaskType.METRIC,
        required: true,
        schedule: { frequency: 'daily', time: '07:00', windowMinutes: 120 },
        completionRule: { metricType: 'blood_glucose' },
        reminderPolicy: { channels: ['in_app'] },
      },
    ],
    rules: [
      {
        operator: 'gte',
        key: 'value',
        value: 180,
        severity: 'attention',
        reasonCode: 'glucose_elevated',
      },
      {
        operator: 'gte',
        key: 'value',
        value: 250,
        severity: 'urgent',
        reasonCode: 'glucose_urgent',
      },
      {
        operator: 'lte',
        key: 'value',
        value: 70,
        severity: 'urgent',
        reasonCode: 'glucose_low_urgent',
      },
    ],
  },
];

export function findStandardCareProgram(programCode: string) {
  return STANDARD_CARE_PROGRAMS.find(
    (program) => program.programCode === programCode,
  );
}
