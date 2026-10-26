import bcrypt from 'bcrypt';
import type { Db } from 'mongodb';
import { withDatabase } from './seed-utils';

const DEMO_PASSWORD = 'Password123!';

export async function seedDemoData(db: Db): Promise<void> {
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = db.collection('users');
  // The canonical user-email index is owned by migrations. Recreating it here
  // can conflict when its partial-filter definition evolves.
  await users.bulkWrite(
    [
      {
        email: 'patient.demo@healthcare.local',
        fullName: 'Demo Patient',
        role: 'patient',
      },
      {
        email: 'admin.demo@healthcare.local',
        fullName: 'Demo Admin',
        role: 'admin',
      },
    ].map((user) => ({
      updateOne: {
        filter: { email: user.email },
        update: {
          // A repeatable demo seed must also repair an older OAuth-only demo
          // account so the documented test credentials remain usable.
          $set: {
            passwordHash: password,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            ...user,
            accountStatus: 'active',
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
  );
}

if (require.main === module) {
  void withDatabase(seedDemoData)
    .then(() => console.log('demo seed applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
