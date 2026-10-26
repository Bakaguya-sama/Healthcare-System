import type { ClientSession } from 'mongoose';

export const CONSULTATION_USAGE_PORT = Symbol('CONSULTATION_USAGE_PORT');

export type ConsultationUsageStatus =
  | 'reserved'
  | 'counted'
  | 'released'
  | 'expired';

/**
 * Public lifecycle contract consumed by Consultations. Billing owns quota,
 * subscription snapshots and ledger persistence; callers provide no limit.
 */
export interface ConsultationUsagePort {
  prepare(patientId: string): Promise<void>;
  listReserved(
    after?: string,
    limit?: number,
  ): Promise<{ consultationId: string; cursor: string }[]>;
  reserve(input: {
    consultationId: string;
    patientId: string;
    session?: ClientSession;
  }): Promise<{ status: ConsultationUsageStatus; created: boolean }>;
  count(input: {
    consultationId: string;
    session?: ClientSession;
  }): Promise<ConsultationUsageStatus | null>;
  release(input: {
    consultationId: string;
    reason: 'cancelled' | 'declined';
    session?: ClientSession;
  }): Promise<ConsultationUsageStatus | null>;
}
