export type MetricType =
  | 'blood_pressure'
  | 'heart_rate'
  | 'blood_glucose'
  | 'oxygen_saturation'
  | 'body_temperature'
  | 'respiratory_rate'
  | 'bmi'
  | 'water_intake'
  | 'kcal_intake';

export type Gender = 'male' | 'female';
export type GenderScope = Gender | 'all';
export type AgeRange = 'all' | 'child' | 'adult';

export type MetricKey = 'value' | 'systolic' | 'diastolic';
export type ConditionOp = 'lt' | 'lte' | 'gt' | 'gte' | 'between';
export type RuleLogic = 'all' | 'any';
export type AlertSeverity = 'none' | 'warning' | 'critical';

export type ThresholdCondition = {
  key: MetricKey;
  op: ConditionOp;
  min?: number;
  max?: number;
};

export type ThresholdRule = {
  status: string;
  severity: AlertSeverity;
  logic: RuleLogic;
  conditions: ThresholdCondition[];
};

export type ThresholdProfile = {
  gender: GenderScope;
  ageRange: AgeRange;
  notes?: string;
  rules: ThresholdRule[];
};

export type HealthThresholds = Record<MetricType, ThresholdProfile[]>;

export type MetricEvaluationInput = Partial<Record<MetricKey, number>>;

export type MetricEvaluationResult = {
  metricType: MetricType;
  status: string;
  severity: AlertSeverity;
  shouldTriggerAlert: boolean;
  profile: Pick<ThresholdProfile, 'gender' | 'ageRange' | 'notes'>;
  matchedRule: ThresholdRule;
};

export const HEALTH_METRIC_THRESHOLDS: HealthThresholds = {
  blood_pressure: [
    {
      gender: 'all',
      ageRange: 'adult',
      rules: [
        {
          status: 'Hypertensive Crisis',
          severity: 'critical',
          logic: 'any',
          conditions: [
            { key: 'systolic', op: 'gt', min: 180 },
            { key: 'diastolic', op: 'gt', min: 120 },
          ],
        },
        {
          status: 'Hypertension Stage 2',
          severity: 'critical',
          logic: 'any',
          conditions: [
            { key: 'systolic', op: 'gte', min: 140 },
            { key: 'diastolic', op: 'gte', min: 90 },
          ],
        },
        {
          status: 'Hypertension Stage 1',
          severity: 'warning',
          logic: 'any',
          conditions: [
            { key: 'systolic', op: 'between', min: 130, max: 139 },
            { key: 'diastolic', op: 'between', min: 80, max: 89 },
          ],
        },
        {
          status: 'Elevated',
          severity: 'warning',
          logic: 'all',
          conditions: [
            { key: 'systolic', op: 'between', min: 120, max: 129 },
            { key: 'diastolic', op: 'lt', max: 80 },
          ],
        },
        {
          status: 'Normal',
          severity: 'none',
          logic: 'all',
          conditions: [
            { key: 'systolic', op: 'lt', max: 120 },
            { key: 'diastolic', op: 'lt', max: 80 },
          ],
        },
      ],
    },
  ],

  heart_rate: [
    {
      gender: 'all',
      ageRange: 'adult',
      notes: 'Resting heart rate in beats per minute (bpm)',
      rules: [
        {
          status: 'Bradycardia (Low)',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 59 }],
        },
        {
          status: 'Normal',
          severity: 'none',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 60, max: 100 }],
        },
        {
          status: 'Tachycardia (High)',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 101 }],
        },
      ],
    },
    {
      gender: 'all',
      ageRange: 'child',
      notes: 'Ages 6-15',
      rules: [
        {
          status: 'Normal',
          severity: 'none',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 70, max: 100 }],
        },
      ],
    },
  ],

  blood_glucose: [
    {
      gender: 'all',
      ageRange: 'adult',
      rules: [
        {
          status: 'Hypoglycemia',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 69 }],
        },
        {
          status: 'Prediabetes',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 100, max: 125 }],
        },
        {
          status: 'Diabetes',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 126 }],
        },
      ],
    },
  ],

  oxygen_saturation: [
    {
      gender: 'all',
      ageRange: 'all',
      notes: 'SpO2 percentage (%)',
      rules: [
        {
          status: 'Severe Hypoxemia (Critical)',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 89 }],
        },
        {
          status: 'Mild Hypoxemia',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 90, max: 94 }],
        },
      ],
    },
  ],

  body_temperature: [
    {
      gender: 'all',
      ageRange: 'all',
      rules: [
        {
          status: 'Hypothermia',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 34.9 }],
        },
        {
          status: 'Elevated',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 37.6, max: 37.9 }],
        },
        {
          status: 'Fever',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 38.0 }],
        },
      ],
    },
  ],

  respiratory_rate: [
    {
      gender: 'all',
      ageRange: 'adult',
      rules: [
        {
          status: 'Bradypnea (Low)',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 11 }],
        },
        {
          status: 'Tachypnea (High)',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 21 }],
        },
      ],
    },
  ],

  bmi: [
    {
      gender: 'all',
      ageRange: 'adult',
      rules: [
        {
          status: 'Underweight',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 18.4 }],
        },
        {
          status: 'Overweight',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 25.0, max: 29.9 }],
        },
        {
          status: 'Obesity',
          severity: 'critical',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 30.0 }],
        },
      ],
    },
  ],

  water_intake: [
    {
      gender: 'male',
      ageRange: 'adult',
      rules: [
        {
          status: 'Below Recommended',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 3.6 }],
        },
        {
          status: 'Recommended Range',
          severity: 'none',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 3.7, max: 5.5 }],
        },
        {
          status: 'Above Recommended',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 5.6 }],
        },
      ],
    },
    {
      gender: 'female',
      ageRange: 'adult',
      rules: [
        {
          status: 'Below Recommended',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lte', max: 2.6 }],
        },
        {
          status: 'Recommended Range',
          severity: 'none',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 2.7, max: 4.5 }],
        },
        {
          status: 'Above Recommended',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gte', min: 4.6 }],
        },
      ],
    },
  ],

  kcal_intake: [
    {
      gender: 'male',
      ageRange: 'adult',
      rules: [
        {
          status: 'Below Maintenance Range',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lt', max: 2000 }],
        },
        {
          status: 'Maintenance Range',
          severity: 'none',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 2000, max: 2600 }],
        },
        {
          status: 'Above Maintenance Range',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gt', min: 2600 }],
        },
      ],
    },
    {
      gender: 'female',
      ageRange: 'adult',
      rules: [
        {
          status: 'Below Maintenance Range',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'lt', max: 1600 }],
        },
        {
          status: 'Maintenance Range',
          severity: 'none',
          logic: 'all',
          conditions: [{ key: 'value', op: 'between', min: 1600, max: 2000 }],
        },
        {
          status: 'Above Maintenance Range',
          severity: 'warning',
          logic: 'all',
          conditions: [{ key: 'value', op: 'gt', min: 2000 }],
        },
      ],
    },
  ],
};

function matchCondition(
  input: MetricEvaluationInput,
  condition: ThresholdCondition,
): boolean {
  const actualValue = input[condition.key];

  if (!Number.isFinite(actualValue)) {
    return false;
  }

  const value = actualValue as number;

  switch (condition.op) {
    case 'lt':
      return condition.max !== undefined ? value < condition.max : false;
    case 'lte':
      return condition.max !== undefined ? value <= condition.max : false;
    case 'gt':
      return condition.min !== undefined ? value > condition.min : false;
    case 'gte':
      return condition.min !== undefined ? value >= condition.min : false;
    case 'between':
      return (
        condition.min !== undefined &&
        condition.max !== undefined &&
        value >= condition.min &&
        value <= condition.max
      );
    default:
      return false;
  }
}

function matchRule(input: MetricEvaluationInput, rule: ThresholdRule): boolean {
  if (rule.conditions.length === 0) {
    return false;
  }

  if (rule.logic === 'all') {
    return rule.conditions.every((condition) =>
      matchCondition(input, condition),
    );
  }

  return rule.conditions.some((condition) => matchCondition(input, condition));
}

function selectProfile(
  metricType: MetricType,
  gender: Gender,
  ageRange: AgeRange,
): ThresholdProfile | null {
  const profiles = HEALTH_METRIC_THRESHOLDS[metricType] ?? [];

  if (profiles.length === 0) {
    return null;
  }

  return (
    profiles.find(
      (profile) => profile.gender === gender && profile.ageRange === ageRange,
    ) ??
    profiles.find(
      (profile) => profile.gender === 'all' && profile.ageRange === ageRange,
    ) ??
    profiles.find(
      (profile) => profile.gender === gender && profile.ageRange === 'all',
    ) ??
    profiles.find(
      (profile) => profile.gender === 'all' && profile.ageRange === 'all',
    ) ??
    null
  );
}

export function calculateAge(
  birthDate: Date | string | null | undefined,
): number | null {
  if (!birthDate) {
    return null;
  }

  const today = new Date();
  const birthDateObj = new Date(birthDate);

  if (Number.isNaN(birthDateObj.getTime())) {
    return null;
  }

  if (birthDateObj.getTime() > today.getTime()) {
    return null;
  }

  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDifference = today.getMonth() - birthDateObj.getMonth();
  const dayDifference = today.getDate() - birthDateObj.getDate();

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age--;
  }

  if (age < 0) {
    return null;
  }

  return age;
}

export function convertBirthdayToAgeRange(
  birthDate?: Date | string | null,
): AgeRange {
  const age = calculateAge(birthDate);

  if (age === null) {
    return 'adult';
  }

  if (age <= 16) return 'child';
  else return 'adult';
}

export function evaluateMetricThreshold(
  metricType: MetricType,
  input: MetricEvaluationInput,
  options?: {
    gender?: Gender;
    birthDay?: Date | string;
  },
): MetricEvaluationResult | null {
  const gender = options?.gender ?? 'male';
  const ageRange = convertBirthdayToAgeRange(options?.birthDay);
  const profile = selectProfile(metricType, gender, ageRange);

  if (!profile) {
    return null;
  }

  const matchedRule = profile.rules.find((rule) => matchRule(input, rule));

  if (!matchedRule) {
    return null;
  }

  return {
    metricType,
    status: matchedRule.status,
    severity: matchedRule.severity,
    shouldTriggerAlert: matchedRule.severity !== 'none',
    profile: {
      gender: profile.gender,
      ageRange: profile.ageRange,
      notes: profile.notes,
    },
    matchedRule,
  };
}
