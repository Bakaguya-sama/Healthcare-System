export const SUMMARY_INPUT_VERSION_V1 = 'v1' as const;

export type SummaryInputV1 = {
  schemaVersion: typeof SUMMARY_INPUT_VERSION_V1;
  reportId: string;
  audience: 'patient' | 'doctor';
  reportWindow: {
    start: string;
    end: string;
    timezone: string;
    dataUntil: string;
  };
  facts: {
    statistics: Record<string, unknown>;
    trends: Record<string, unknown>;
    missingData: unknown[];
    healthEvaluations: Record<string, unknown>;
    consultations: Record<string, unknown> | null;
  };
  provenance: {
    inputHash: string;
    reportVersion: number;
    sourceCounts: Record<string, number>;
    sourceReferences?: Record<string, string[]>;
  };
};

export const SUMMARY_INPUT_V1_JSON_SCHEMA = {
  $id: 'care-summary-input-v1',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'reportId',
    'audience',
    'reportWindow',
    'facts',
    'provenance',
  ],
  properties: {
    schemaVersion: { const: SUMMARY_INPUT_VERSION_V1 },
    reportId: { type: 'string' },
    audience: { enum: ['patient', 'doctor'] },
    reportWindow: { type: 'object' },
    facts: { type: 'object' },
    provenance: { type: 'object' },
  },
} as const;
