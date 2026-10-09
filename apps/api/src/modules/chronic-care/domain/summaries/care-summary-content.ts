export type CareSummaryContent = {
  overview: string;
  observations: string[];
  missingData: string[];
  alertsToMention: string[];
  questionsForDoctor: string[];
  disclaimer: string;
};

const CONTENT_KEYS = [
  'overview',
  'observations',
  'missingData',
  'alertsToMention',
  'questionsForDoctor',
  'disclaimer',
] as const;
const FORBIDDEN_LANGUAGE =
  /\b(diagnos(?:is|e|ed)|prescri(?:be|ption)|dose|dosage|stop (?:taking|medication)|replace your (?:doctor|treatment)|definitely)\b/i;

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export function validateCareSummaryContent(value: unknown): {
  valid: boolean;
  reasonCodes: string[];
  content?: CareSummaryContent;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { valid: false, reasonCodes: ['summary_schema_invalid'] };
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !CONTENT_KEYS.includes(key as never)))
    return { valid: false, reasonCodes: ['summary_schema_invalid'] };
  if (
    typeof source.overview !== 'string' ||
    typeof source.disclaimer !== 'string' ||
    !isStringArray(source.observations) ||
    !isStringArray(source.missingData) ||
    !isStringArray(source.alertsToMention) ||
    !isStringArray(source.questionsForDoctor)
  )
    return { valid: false, reasonCodes: ['summary_schema_invalid'] };
  const content: CareSummaryContent = {
    overview: source.overview,
    observations: source.observations,
    missingData: source.missingData,
    alertsToMention: source.alertsToMention,
    questionsForDoctor: source.questionsForDoctor,
    disclaimer: source.disclaimer,
  };
  const text = Object.values(content).flat().join(' ');
  if (FORBIDDEN_LANGUAGE.test(text))
    return { valid: false, reasonCodes: ['summary_safety_forbidden_claim'] };
  return { valid: true, reasonCodes: [], content };
}

export function createDeterministicCareSummary(input: {
  audience: 'patient' | 'doctor';
  missingData: unknown[];
}): CareSummaryContent {
  return {
    overview:
      'This summary is based on the recorded report facts for this period.',
    observations: [],
    missingData:
      input.missingData.length > 0
        ? [
            'Some planned monitoring data is missing from this reporting period.',
          ]
        : [],
    alertsToMention: [],
    questionsForDoctor:
      input.audience === 'doctor'
        ? ['Review the deterministic report facts and any outstanding alerts.']
        : [],
    disclaimer:
      'This summary is informational and does not replace advice from your healthcare professional or emergency services.',
  };
}

export function isNumericallyGrounded(
  content: CareSummaryContent,
  facts: unknown,
): boolean {
  const sourceNumbers = new Set(
    JSON.stringify(facts).match(/-?\d+(?:\.\d+)?/g) ?? [],
  );
  const narrativeNumbers =
    JSON.stringify(content).match(/-?\d+(?:\.\d+)?/g) ?? [];
  return narrativeNumbers.every((number) => sourceNumbers.has(number));
}
