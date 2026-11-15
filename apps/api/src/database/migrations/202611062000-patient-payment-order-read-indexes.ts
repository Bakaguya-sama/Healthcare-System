import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const PATIENT_PAYMENT_ORDER_READ_INDEXES_VERSION = 202611062000;
export const PATIENT_PAYMENT_ORDER_READ_INDEXES_NAME =
  'patient-payment-order-read-indexes';
export const PATIENT_PAYMENT_ORDER_READ_INDEXES_CHECKSUM = migrationChecksum({
  version: PATIENT_PAYMENT_ORDER_READ_INDEXES_VERSION,
  name: PATIENT_PAYMENT_ORDER_READ_INDEXES_NAME,
  steps: ['create-owner-scoped-stable-payment-order-read-indexes'],
});

export const PATIENT_PAYMENT_ORDER_READ_INDEXES = [
  {
    collection: 'paymentorders',
    name: 'userId_1_createdAt_-1__id_-1',
    key: { userId: 1, createdAt: -1, _id: -1 },
  },
  {
    collection: 'paymentorders',
    name: 'userId_1_status_1_createdAt_-1__id_-1',
    key: { userId: 1, status: 1, createdAt: -1, _id: -1 },
  },
] as const;

export async function applyPatientPaymentOrderReadIndexes(
  db: Db,
): Promise<void> {
  for (const index of PATIENT_PAYMENT_ORDER_READ_INDEXES)
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
    });
}
