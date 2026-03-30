import { useMemo } from "react";

export type MetricsTypes =
  | "blood_pressure"
  | "heart_rate"
  | "bmi"
  | "height"
  | "weight"
  | "water_intake"
  | "kcal_intake"
  | "blood_glucose"
  | "oxygen_saturation"
  | "body_temperature"
  | "respiratory_rate";

export type TableStatus = "normal" | "high" | "low";

type EvaluatorMetricType = Exclude<MetricsTypes, "height" | "weight">;
type Gender = "male" | "female";
type GenderScope = Gender | "all";
type AgeRange = "all" | "child" | "adult";
type MetricKey = "value" | "systolic" | "diastolic";
type ConditionOp = "lt" | "lte" | "gt" | "gte" | "between";
type RuleLogic = "all" | "any";
type AlertSeverity = "none" | "warning" | "critical";

type ThresholdCondition = {
  key: MetricKey;
  op: ConditionOp;
  min?: number;
  max?: number;
};

type ThresholdRule = {
  status: string;
  severity: AlertSeverity;
  logic: RuleLogic;
  conditions: ThresholdCondition[];
};

type ThresholdProfile = {
  gender: GenderScope;
  ageRange: AgeRange;
  notes?: string;
  rules: ThresholdRule[];
};

type HealthThresholds = Record<EvaluatorMetricType, ThresholdProfile[]>;
type MetricEvaluationInput = Partial<Record<MetricKey, number>>;

export type MetricReading = {
  id: string;
  recordedAt: string;
  primaryValue: number;
  secondaryValue?: number;
  status: TableStatus;
};

type EvaluateOptions = {
  gender?: Gender;
  birthDay?: Date | string;
};

type UseMetricStatusParams = {
  metricType: MetricsTypes;
  entries: MetricReading[];
  options?: EvaluateOptions;
};

const HEALTH_METRIC_THRESHOLDS: HealthThresholds = {
  blood_pressure: [
    {
      gender: "all",
      ageRange: "adult",
      rules: [
        {
          status: "Hypertensive Crisis",
          severity: "critical",
          logic: "any",
          conditions: [
            { key: "systolic", op: "gt", min: 180 },
            { key: "diastolic", op: "gt", min: 120 },
          ],
        },
        {
          status: "Hypertension Stage 2",
          severity: "critical",
          logic: "any",
          conditions: [
            { key: "systolic", op: "gte", min: 140 },
            { key: "diastolic", op: "gte", min: 90 },
          ],
        },
        {
          status: "Hypertension Stage 1",
          severity: "warning",
          logic: "any",
          conditions: [
            { key: "systolic", op: "between", min: 130, max: 139 },
            { key: "diastolic", op: "between", min: 80, max: 89 },
          ],
        },
        {
          status: "Elevated",
          severity: "warning",
          logic: "all",
          conditions: [
            { key: "systolic", op: "between", min: 120, max: 129 },
            { key: "diastolic", op: "lt", max: 80 },
          ],
        },
        {
          status: "Normal",
          severity: "none",
          logic: "all",
          conditions: [
            { key: "systolic", op: "lt", max: 120 },
            { key: "diastolic", op: "lt", max: 80 },
          ],
        },
      ],
    },
  ],
  heart_rate: [
    {
      gender: "all",
      ageRange: "adult",
      rules: [
        {
          status: "Bradycardia (Low)",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 59 }],
        },
        {
          status: "Normal",
          severity: "none",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 60, max: 100 }],
        },
        {
          status: "Tachycardia (High)",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "gte", min: 101 }],
        },
      ],
    },
    {
      gender: "all",
      ageRange: "child",
      rules: [
        {
          status: "Normal",
          severity: "none",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 70, max: 100 }],
        },
      ],
    },
  ],
  blood_glucose: [
    {
      gender: "all",
      ageRange: "adult",
      rules: [
        {
          status: "Hypoglycemia",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 69 }],
        },
        {
          status: "Prediabetes",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 100, max: 125 }],
        },
        {
          status: "Diabetes",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "gte", min: 126 }],
        },
      ],
    },
  ],
  oxygen_saturation: [
    {
      gender: "all",
      ageRange: "all",
      rules: [
        {
          status: "Severe Hypoxemia (Critical)",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 89 }],
        },
        {
          status: "Mild Hypoxemia",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 90, max: 94 }],
        },
      ],
    },
  ],
  body_temperature: [
    {
      gender: "all",
      ageRange: "all",
      rules: [
        {
          status: "Hypothermia",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 34.9 }],
        },
        {
          status: "Elevated",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 37.6, max: 37.9 }],
        },
        {
          status: "Fever",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "gte", min: 38.0 }],
        },
      ],
    },
  ],
  respiratory_rate: [
    {
      gender: "all",
      ageRange: "adult",
      rules: [
        {
          status: "Bradypnea (Low)",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 11 }],
        },
        {
          status: "Tachypnea (High)",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "gte", min: 21 }],
        },
      ],
    },
  ],
  bmi: [
    {
      gender: "all",
      ageRange: "adult",
      rules: [
        {
          status: "Underweight",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 18.4 }],
        },
        {
          status: "Overweight",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 25.0, max: 29.9 }],
        },
        {
          status: "Obesity",
          severity: "critical",
          logic: "all",
          conditions: [{ key: "value", op: "gte", min: 30.0 }],
        },
      ],
    },
  ],
  water_intake: [
    {
      gender: "male",
      ageRange: "adult",
      rules: [
        {
          status: "Below Recommended",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 3.6 }],
        },
      ],
    },
    {
      gender: "female",
      ageRange: "adult",
      rules: [
        {
          status: "Below Recommended",
          severity: "warning",
          logic: "all",
          conditions: [{ key: "value", op: "lte", max: 2.6 }],
        },
      ],
    },
  ],
  kcal_intake: [
    {
      gender: "male",
      ageRange: "adult",
      rules: [
        {
          status: "Maintenance Range",
          severity: "none",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 2000, max: 2600 }],
        },
      ],
    },
    {
      gender: "female",
      ageRange: "adult",
      rules: [
        {
          status: "Maintenance Range",
          severity: "none",
          logic: "all",
          conditions: [{ key: "value", op: "between", min: 1600, max: 2000 }],
        },
      ],
    },
  ],
};

const LOW_STATUS_KEYWORDS = ["low", "hypo", "under", "below"];

function isEvaluatorMetricType(
  metricType: MetricsTypes,
): metricType is EvaluatorMetricType {
  return metricType !== "height" && metricType !== "weight";
}

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
    case "lt":
      return condition.max !== undefined ? value < condition.max : false;
    case "lte":
      return condition.max !== undefined ? value <= condition.max : false;
    case "gt":
      return condition.min !== undefined ? value > condition.min : false;
    case "gte":
      return condition.min !== undefined ? value >= condition.min : false;
    case "between":
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

  if (rule.logic === "all") {
    return rule.conditions.every((condition) =>
      matchCondition(input, condition),
    );
  }

  return rule.conditions.some((condition) => matchCondition(input, condition));
}

function calculateAge(
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
    age -= 1;
  }

  if (age < 0) {
    return null;
  }

  return age;
}

function convertBirthdayToAgeRange(birthDate?: Date | string | null): AgeRange {
  const age = calculateAge(birthDate);
  if (age === null) {
    return "adult";
  }
  return age <= 16 ? "child" : "adult";
}

function selectProfile(
  metricType: EvaluatorMetricType,
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
      (profile) => profile.gender === "all" && profile.ageRange === ageRange,
    ) ??
    profiles.find(
      (profile) => profile.gender === gender && profile.ageRange === "all",
    ) ??
    profiles.find(
      (profile) => profile.gender === "all" && profile.ageRange === "all",
    ) ??
    null
  );
}

function mapRuleToTableStatus(rule: ThresholdRule): TableStatus {
  if (rule.severity === "none") {
    return "normal";
  }

  const normalizedStatus = rule.status.toLowerCase();
  if (
    LOW_STATUS_KEYWORDS.some((keyword) => normalizedStatus.includes(keyword))
  ) {
    return "low";
  }

  return "high";
}

function evaluateMetricStatus(
  metricType: MetricsTypes,
  entry: MetricReading,
  options?: EvaluateOptions,
): TableStatus {
  if (!isEvaluatorMetricType(metricType)) {
    return entry.status ?? "normal";
  }

  const gender = options?.gender ?? "male";
  const ageRange = convertBirthdayToAgeRange(options?.birthDay);
  const profile = selectProfile(metricType, gender, ageRange);

  if (!profile) {
    return entry.status ?? "normal";
  }

  const input: MetricEvaluationInput =
    metricType === "blood_pressure"
      ? {
          systolic: entry.primaryValue,
          diastolic: entry.secondaryValue,
        }
      : {
          value: entry.primaryValue,
        };

  const matchedRule = profile.rules.find((rule) => matchRule(input, rule));

  if (!matchedRule) {
    return entry.status ?? "normal";
  }

  return mapRuleToTableStatus(matchedRule);
}

export function useMetricStatus({
  metricType,
  entries,
  options,
}: UseMetricStatusParams): MetricReading[] {
  const gender = options?.gender;
  const birthDay = options?.birthDay;

  return useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        status: evaluateMetricStatus(metricType, entry, { gender, birthDay }),
      })),
    [entries, metricType, birthDay, gender],
  );
}
