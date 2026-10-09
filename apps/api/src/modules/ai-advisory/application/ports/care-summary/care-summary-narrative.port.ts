export const CARE_SUMMARY_NARRATIVE_PORT = Symbol(
  'CARE_SUMMARY_NARRATIVE_PORT',
);

export type CareSummaryNarrativeRequest = {
  audience: 'patient' | 'doctor';
  reportWindow: { start: string; end: string; timezone: string };
  facts: {
    statistics: Record<string, unknown>;
    trends: Record<string, unknown>;
    missingData: unknown[];
    healthEvaluations: Record<string, unknown>;
    consultations: Record<string, unknown> | null;
  };
};

export interface CareSummaryNarrativePort {
  generate(input: CareSummaryNarrativeRequest): Promise<unknown>;
}
