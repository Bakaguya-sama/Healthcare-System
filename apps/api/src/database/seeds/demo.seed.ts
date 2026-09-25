import bcrypt from 'bcrypt';
import type { Db } from 'mongodb';
import { withDatabase } from './seed-utils';

const DEMO_PASSWORD = 'Password123!';

export async function seedDemoData(db: Db): Promise<void> {
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { name: 'email_1', unique: true });
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
          $setOnInsert: {
            ...user,
            password,
            accountStatus: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
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
