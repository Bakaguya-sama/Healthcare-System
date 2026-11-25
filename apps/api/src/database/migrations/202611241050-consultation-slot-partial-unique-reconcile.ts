import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
import { applyConsultationSlotPartialUnique } from './202611231200-consultation-slot-partial-unique';

export const CONSULTATION_SLOT_RECONCILE_VERSION = 202611241050;
export const CONSULTATION_SLOT_RECONCILE_NAME =
  'consultation-slot-partial-unique-reconcile';
export const CONSULTATION_SLOT_RECONCILE_CHECKSUM = migrationChecksum({
  version: CONSULTATION_SLOT_RECONCILE_VERSION,
  name: CONSULTATION_SLOT_RECONCILE_NAME,
  semantics: 'restore partial unique slot index after E1 index reconciliation',
});

export async function reconcileConsultationSlotPartialUnique(db: Db) {
  await applyConsultationSlotPartialUnique(db);
}
