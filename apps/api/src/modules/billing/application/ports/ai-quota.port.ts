export const AI_QUOTA_PORT = Symbol('AI_QUOTA_PORT');
export type AiQuotaReservationResult = {
  reservationId: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  status:
    | 'reserved'
    | 'committed'
    | 'released'
    | 'usage_reconciliation_required';
};
export interface AiQuotaPort {
  reserve(input: {
    userId: string;
    idempotencyKey: string;
    estimatedInputTokens: number;
    maxOutputTokens: number;
  }): Promise<AiQuotaReservationResult>;
  commit(input: {
    reservationId: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void>;
  release(reservationId: string): Promise<void>;
  markUsageReconciliationRequired(
    reservationId: string,
    reason: string,
  ): Promise<void>;
}
