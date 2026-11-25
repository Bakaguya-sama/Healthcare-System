import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const E2_FAMILY_PHONE_LOOKUP_VERSION = 202611231410;
export const E2_FAMILY_PHONE_LOOKUP_NAME = 'e2-family-phone-lookup-index';
export const E2_FAMILY_PHONE_LOOKUP_CHECKSUM = migrationChecksum({
  version: E2_FAMILY_PHONE_LOOKUP_VERSION,
  name: E2_FAMILY_PHONE_LOOKUP_NAME,
  index: 'users.phoneNumber_1_phoneVerifiedAt_1_role_1_accountStatus_1',
});

export async function applyE2FamilyPhoneLookupIndex(db: Db): Promise<void> {
  await db.collection('users').createIndex(
    { phoneNumber: 1, phoneVerifiedAt: 1, role: 1, accountStatus: 1 },
    { name: 'phoneNumber_1_phoneVerifiedAt_1_role_1_accountStatus_1', sparse: true },
  );
}
