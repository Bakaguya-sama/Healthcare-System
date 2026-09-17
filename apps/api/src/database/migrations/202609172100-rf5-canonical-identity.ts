/* MongoDB driver documents are intentionally schema-less at migration boundaries. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';

export const RF5_CANONICAL_IDENTITY_VERSION = 202609172100;
export const RF5_CANONICAL_IDENTITY_NAME = 'rf5-canonical-identity';

export const RF5_CANONICAL_IDENTITY_CHECKSUM = migrationChecksum({
  version: RF5_CANONICAL_IDENTITY_VERSION,
  name: RF5_CANONICAL_IDENTITY_NAME,
  steps: ['backfill-password-hash', 'embed-doctor-profile', 'remove-auth-secrets'],
});

export async function applyRf5CanonicalIdentity(db: Db): Promise<void> {
  const users = db.collection('users');
  const doctors = db.collection('doctors');

  // Existing installations used `password`; make the canonical field explicit.
  await users.updateMany(
    { passwordHash: { $exists: false }, password: { $type: 'string' } },
    [{ $set: { passwordHash: '$password' } }, { $unset: 'password' }],
  );

  // Move the legacy doctor profile into the canonical User document.
  const legacyDoctors = await doctors.find({}).toArray();
  for (const doctor of legacyDoctors) {
    if (!doctor.userId) continue;
    await users.updateOne(
      { _id: doctor.userId },
      {
        $set: {
          doctorProfile: {
            specialty: doctor.specialty,
            workplace: doctor.workplace,
            verificationDocuments: doctor.verificationDocuments ?? [],
            experienceYears: doctor.experienceYears,
            averageRating: doctor.averageRating ?? 0,
            ratingSum: doctor.ratingSum ?? 0,
            reviewCount: doctor.reviewCount ?? 0,
            verifiedAt: doctor.verifiedAt,
            verificationStatus: doctor.verificationStatus ?? 'pending',
            rejectReason: doctor.rejectReason,
          },
        },
      },
    );
  }

  await users.updateMany({}, { $unset: { otpCode: '', otpExpiresAt: '', refreshToken: '' } });
  await users.createIndex({ email: 1 }, { name: 'email_1', unique: true });
  await users.createIndex(
    { role: 1, accountStatus: 1, _id: 1 },
    { name: 'role_1_accountStatus_1__id_1' },
  );
  await users.createIndex(
    { role: 1, 'doctorProfile.verificationStatus': 1, _id: 1 },
    { name: 'role_1_doctorProfile.verificationStatus_1__id_1' },
  );
  await users.createIndex(
    { 'doctorProfile.specialty': 1, role: 1, accountStatus: 1, _id: 1 },
    { name: 'doctorProfile.specialty_1_role_1_accountStatus_1__id_1' },
  );
  await db.collection('auth_sessions').createIndex(
    { refreshTokenHash: 1 },
    { name: 'refreshTokenHash_1', unique: true },
  );
  await db.collection('auth_sessions').createIndex(
    { userId: 1, revokedAt: 1, expiresAt: 1 },
    { name: 'userId_1_revokedAt_1_expiresAt_1' },
  );
  await db.collection('auth_sessions').createIndex(
    { expiresAt: 1 },
    { name: 'expiresAt_1', expireAfterSeconds: 0 },
  );
  await db.collection('auth_events').createIndex(
    { userId: 1, createdAt: -1, _id: -1 },
    { name: 'userId_1_createdAt_-1__id_-1' },
  );
}
