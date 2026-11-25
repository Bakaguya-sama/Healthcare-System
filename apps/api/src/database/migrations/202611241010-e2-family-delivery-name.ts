import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E2_FAMILY_DELIVERY_NAME_VERSION = 202611241010;
export const E2_FAMILY_DELIVERY_NAME = 'e2-family-delivery-name';
export const E2_FAMILY_DELIVERY_NAME_CHECKSUM = migrationChecksum({
  version: E2_FAMILY_DELIVERY_NAME_VERSION,
  name: E2_FAMILY_DELIVERY_NAME,
  collection: 'familylinks',
  rename: 'direct_lookup-to-selected_contact',
});

export async function applyE2FamilyDeliveryName(db: Db): Promise<void> {
  await db.collection('familylinks').updateMany(
    { invitationDelivery: 'direct_lookup' },
    { $set: { invitationDelivery: 'selected_contact' } },
  );
}
