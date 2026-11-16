import bcrypt from 'bcrypt';
import type { Db } from 'mongodb';
import { withDatabase } from './seed-utils';

const DEMO_PASSWORD = 'Password123!';

interface DemoSeedUser {
  email: string;
  fullName: string;
  role: 'patient' | 'doctor' | 'admin';
  phoneNumber?: string;
  gender?: string;
  avatarUrl?: string;
  adminProfile?: {
    adminRole: 'super_admin' | 'user_admin' | 'ai_admin';
  };
  doctorProfile?: {
    specialty: string;
    workplace: string;
    experienceYears: number;
    verificationDocuments: string[];
    verificationStatus: 'approved' | 'pending' | 'rejected';
    verifiedAt: Date;
    averageRating: number;
    ratingSum: number;
    reviewCount: number;
    rejectReason: string;
  };
}

export async function seedDemoData(db: Db): Promise<void> {
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = db.collection('users');
  const now = new Date();
  const demoUsers: DemoSeedUser[] = [
    {
      email: 'patient.demo@healthcare.local',
      fullName: 'Demo Patient',
      role: 'patient',
    },
    {
      email: 'doctor.demo@healthcare.local',
      fullName: 'BS. Nguyễn Minh Khoa',
      role: 'doctor',
      phoneNumber: '0901234568',
      gender: 'male',
      avatarUrl:
        'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&auto=format&fit=crop&q=80',
      doctorProfile: {
        specialty: 'Tim mạch - Nội tiết',
        workplace: 'Bệnh viện Đại học Y Dược TP.HCM',
        experienceYears: 10,
        verificationDocuments: [
          'https://res.cloudinary.com/demo/image/upload/sample.pdf',
        ],
        verificationStatus: 'approved',
        verifiedAt: now,
        averageRating: 4.9,
        ratingSum: 49,
        reviewCount: 10,
        rejectReason: '',
      },
    },
    {
      email: 'admin.demo@healthcare.local',
      fullName: 'Demo Admin',
      role: 'admin',
      adminProfile: {
        adminRole: 'super_admin',
      },
    },
  ];

  // The canonical user-email index is owned by migrations. Recreating it here
  // can conflict when its partial-filter definition evolves.
  await users.bulkWrite(
    demoUsers.map(
      ({
        email,
        fullName,
        role,
        phoneNumber,
        gender,
        avatarUrl,
        adminProfile,
        doctorProfile,
      }) => ({
        updateOne: {
          filter: { email },
          update: {
            // A repeatable demo seed must also repair an older OAuth-only demo
            // account so the documented test credentials remain usable.
            $set: {
              fullName,
              role,
              passwordHash: password,
              updatedAt: now,
              ...(phoneNumber ? { phoneNumber } : {}),
              ...(gender ? { gender } : {}),
              ...(avatarUrl ? { avatarUrl } : {}),
              ...(adminProfile ? { adminProfile } : {}),
              ...(doctorProfile ? { doctorProfile } : {}),
            },
            $setOnInsert: {
              email,
              accountStatus: 'active',
              createdAt: now,
            },
          },
          upsert: true,
        },
      }),
    ),
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
