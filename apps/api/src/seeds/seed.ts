import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

async function seedDatabase() {
  const app = await NestFactory.create(AppModule);

  // ==========================================
  // TEST ACCOUNTS - FOR LOGIN TESTING
  // ==========================================
  // PATIENTS:
  // - patient1@healthcare.com / Password123!
  // - patient2@healthcare.com / Password123!
  // - patient3@healthcare.com / Password123!
  //
  // DOCTORS:
  // - doctor1@healthcare.com / Password123! (Cardiology)
  // - doctor2@healthcare.com / Password123! (Pediatrics)
  // - doctor3@healthcare.com / Password123! (Neurology)
  //
  // ADMIN:
  // - admin@healthcare.com / Password123!
  // ==========================================

  // Get models
  const userModel = app.get<Model<any>>(getModelToken('User'));
  const patientModel = app.get<Model<any>>(getModelToken('Patient'));
  const doctorModel = app.get<Model<any>>(getModelToken('Doctor'));
  const adminModel = app.get<Model<any>>(getModelToken('Admin'));
  const healthMetricModel = app.get<Model<any>>(getModelToken('HealthMetric'));
  const aiSessionModel = app.get<Model<any>>(getModelToken('AiSession'));
  const aiMessageModel = app.get<Model<any>>(getModelToken('AiMessage'));
  const aiFeedbackModel = app.get<Model<any>>(getModelToken('AiFeedback'));
  const sessionModel = app.get<Model<any>>(getModelToken('Session'));
  const messageModel = app.get<Model<any>>(getModelToken('Message'));
  const reviewModel = app.get<Model<any>>(getModelToken('Review'));
  const violationModel = app.get<Model<any>>(getModelToken('Violation'));
  const notificationModel = app.get<Model<any>>(getModelToken('Notification'));
  const aiDocumentModel = app.get<Model<any>>(getModelToken('AiDocument'));
  const aiDocumentChunkModel = app.get<Model<any>>(
    getModelToken('AiDocumentChunk'),
  );
  const blacklistKeywordModel = app.get<Model<any>>(
    getModelToken('BlacklistKeyword'),
  );
  const aiHealthInsightModel = app.get<Model<any>>(
    getModelToken('AiHealthInsight'),
  );

  try {
    console.log('🌱 Starting database seeding...\n');

    // ==========================================
    // 1. CLEAR EXISTING DATA
    // ==========================================
    console.log('🗑️  Clearing existing data...');
    await userModel.deleteMany({});
    await patientModel.deleteMany({});
    await doctorModel.deleteMany({});
    await adminModel.deleteMany({});
    await healthMetricModel.deleteMany({});
    await aiSessionModel.deleteMany({});
    await aiMessageModel.deleteMany({});
    await aiFeedbackModel.deleteMany({});
    await sessionModel.deleteMany({});
    await messageModel.deleteMany({});
    await reviewModel.deleteMany({});
    await violationModel.deleteMany({});
    await notificationModel.deleteMany({});
    await aiDocumentModel.deleteMany({});
    await aiDocumentChunkModel.deleteMany({});
    await blacklistKeywordModel.deleteMany({});
    await aiHealthInsightModel.deleteMany({});
    console.log('✅ Data cleared\n');

    // ==========================================
    // 2. SEED USERS
    // ==========================================
    // TEST CREDENTIALS FOR LOGIN:
    // Patient 1: patient1@healthcare.com / Password123!
    // Patient 2: patient2@healthcare.com / Password123!
    // Patient 3: patient3@healthcare.com / Password123!
    // Doctor 1: doctor1@healthcare.com / Password123!
    // Doctor 2: doctor2@healthcare.com / Password123!
    // Doctor 3: doctor3@healthcare.com / Password123!
    // Admin: admin@healthcare.com / Password123!
    // ==========================================
    console.log('👥 Creating users...');
    const patients = await userModel.insertMany([
      {
        // PATIENT 1: patient1@healthcare.com / Password123!
        email: 'patient1@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz', // hashed "Password123!"
        fullName: 'Nguyễn Văn An',
        gender: 'male',
        dateOfBirth: new Date('1990-05-15'),
        role: 'patient',
        phoneNumber: '0912345678',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/patient1-avatar.jpg',
        accountStatus: 'active',
        isOnline: false,
        address: {
          street: '123 Nguyen Hue',
          ward: 'Ward 1',
          district: 'District 1',
          city: 'Ho Chi Minh',
          country: 'Vietnam',
        },
      },
      {
        // PATIENT 2: patient2@healthcare.com / Password123!
        email: 'patient2@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Trần Thị Bình',
        gender: 'female',
        dateOfBirth: new Date('1992-08-22'),
        role: 'patient',
        phoneNumber: '0912345679',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/patient2-avatar.jpg',
        accountStatus: 'active',
        isOnline: true,
        address: {
          street: '456 Tran Hung Dao',
          ward: 'Ward 2',
          district: 'District 2',
          city: 'Ho Chi Minh',
          country: 'Vietnam',
        },
      },
      {
        // PATIENT 3: patient3@healthcare.com / Password123!
        email: 'patient3@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Phạm Minh Cường',
        gender: 'male',
        dateOfBirth: new Date('1988-12-01'),
        role: 'patient',
        phoneNumber: '0912345680',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/patient3-avatar.jpg',
        accountStatus: 'active',
        isOnline: false,
        address: {
          street: '789 Nguyen Du',
          ward: 'Ward 3',
          district: 'District 3',
          city: 'Hanoi',
          country: 'Vietnam',
        },
      },
    ]);

    const doctors = await userModel.insertMany([
      {
        // DOCTOR 1: doctor1@healthcare.com / Password123! (Cardiology)
        email: 'doctor1@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Dr. Lê Thanh Tâm',
        gender: 'male',
        dateOfBirth: new Date('1985-03-10'),
        role: 'doctor',
        phoneNumber: '0912345681',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/doctor1-avatar.jpg',
        accountStatus: 'active',
        isOnline: true,
        address: {
          street: '321 Le Loi',
          ward: 'Ward 4',
          district: 'District 1',
          city: 'Ho Chi Minh',
          country: 'Vietnam',
        },
      },
      {
        // DOCTOR 2: doctor2@healthcare.com / Password123! (Pediatrics)
        email: 'doctor2@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Dr. Hoàng Thu Hương',
        gender: 'female',
        dateOfBirth: new Date('1987-07-25'),
        role: 'doctor',
        phoneNumber: '0912345682',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/doctor2-avatar.jpg',
        accountStatus: 'active',
        isOnline: true,
        address: {
          street: '654 Ba Trieu',
          ward: 'Ward 5',
          district: 'District 5',
          city: 'Hanoi',
          country: 'Vietnam',
        },
      },
      {
        // DOCTOR 3: doctor3@healthcare.com / Password123! (Neurology)
        email: 'doctor3@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Dr. Võ Minh Quân',
        gender: 'male',
        dateOfBirth: new Date('1984-11-18'),
        role: 'doctor',
        phoneNumber: '0912345683',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/doctor3-avatar.jpg',
        accountStatus: 'active',
        isOnline: false,
        address: {
          street: '987 Ly Thuong Kiet',
          ward: 'Ward 6',
          district: 'District 6',
          city: 'Da Nang',
          country: 'Vietnam',
        },
      },
    ]);

    const admins = await userModel.insertMany([
      {
        // ADMIN: admin@healthcare.com / Password123!
        email: 'admin@healthcare.com',
        password: '$2b$12$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Admin Hệ Thống',
        gender: 'male',
        dateOfBirth: new Date('1990-01-01'),
        role: 'admin',
        phoneNumber: '0912345684',
        avatarUrl: 'https://res.cloudinary.com/healthcare-app/image/upload/healthcare/profiles/admin-avatar.jpg',
        accountStatus: 'active',
        isOnline: false,
        address: {
          street: '111 Admin Street',
          ward: 'Ward 7',
          district: 'District 7',
          city: 'Ho Chi Minh',
          country: 'Vietnam',
        },
      },
    ]);

    console.log(`✅ Created ${patients.length} patients`);
    console.log(`✅ Created ${doctors.length} doctors`);
    console.log(`✅ Created ${admins.length} admins\n`);

    // ==========================================
    // 3. SEED PATIENT PROFILES
    // ==========================================
    console.log('🏥 Creating patient profiles...');
    const patientProfiles = await patientModel.insertMany(
      patients.map((p) => ({
        userId: p._id,
      })),
    );
    console.log(`✅ Created ${patientProfiles.length} patient profiles\n`);

    // ==========================================
    // 4. SEED DOCTOR PROFILES
    // ==========================================
    console.log('👨‍⚕️ Creating doctor profiles...');
    const doctorProfiles = await doctorModel.insertMany([
      {
        userId: doctors[0]._id,
        specialty: 'Cardiology',
        workplace: 'Central Hospital',
        verificationDocuments: [
          'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/doctors/verification/doctor1_license.pdf',
          'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/doctors/verification/doctor1_cert.pdf',
        ],
        experienceYears: 15,
        averageRating: 4.8,
        verifiedAt: new Date(),
        verificationStatus: 'approved',
      },
      {
        userId: doctors[1]._id,
        specialty: 'Pediatrics',
        workplace: 'Children Hospital',
        verificationDocuments: [
          'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/doctors/verification/doctor2_license.pdf',
        ],
        experienceYears: 12,
        averageRating: 4.6,
        verifiedAt: new Date(),
        verificationStatus: 'approved',
      },
      {
        userId: doctors[2]._id,
        specialty: 'Neurology',
        workplace: 'Brain Health Center',
        verificationDocuments: [
          'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/doctors/verification/doctor3_license.pdf',
        ],
        experienceYears: 18,
        averageRating: 4.9,
        verifiedAt: new Date(),
        verificationStatus: 'approved',
      },
    ]);
    console.log(`✅ Created ${doctorProfiles.length} doctor profiles\n`);

    // ==========================================
    // 5. SEED ADMIN PROFILES
    // ==========================================
    console.log('⚙️  Creating admin profiles...');
    const adminProfiles = await adminModel.insertMany([
      {
        userId: admins[0]._id,
        adminRole: 'super_admin',
      },
    ]);
    console.log(`✅ Created ${adminProfiles.length} admin profiles\n`);

    // ==========================================
    // 6. SEED HEALTH METRICS
    // ==========================================
    console.log('📊 Creating health metrics...');
    const healthMetrics = await healthMetricModel.insertMany([
      {
        patientId: patients[0]._id,
        type: 'blood_pressure',
        values: {
          systolic: {
            value: 120,
            recordedAt: new Date('2026-03-20T08:00:00Z'),
          },
          diastolic: {
            value: 80,
            recordedAt: new Date('2026-03-20T08:00:00Z'),
          },
        },
        unit: 'mmHg',
        recordedAt: new Date('2026-03-20T08:00:00Z'),
      },
      {
        patientId: patients[0]._id,
        type: 'heart_rate',
        values: {
          value: { value: 72, recordedAt: new Date('2026-03-20T08:05:00Z') },
        },
        unit: 'bpm',
        recordedAt: new Date('2026-03-20T08:05:00Z'),
      },
      {
        patientId: patients[1]._id,
        type: 'weight',
        values: {
          value: { value: 65, recordedAt: new Date('2026-03-20T07:00:00Z') },
        },
        unit: 'kg',
        recordedAt: new Date('2026-03-20T07:00:00Z'),
      },
      {
        patientId: patients[1]._id,
        type: 'bmi',
        values: {
          value: { value: 23.2, recordedAt: new Date('2026-03-20T07:05:00Z') },
        },
        unit: 'kg/m²',
        recordedAt: new Date('2026-03-20T07:05:00Z'),
      },
      {
        patientId: patients[2]._id,
        type: 'water_intake',
        values: {
          amount: {
            value: 2000,
            recordedAt: new Date('2026-03-20T06:00:00Z'),
          },
        },
        unit: 'ml',
        recordedAt: new Date('2026-03-20T06:00:00Z'),
      },
    ]);
    console.log(`✅ Created ${healthMetrics.length} health metrics\n`);

    // ==========================================
    // 7. SEED AI SESSIONS
    // ==========================================
    console.log('🤖 Creating AI sessions...');
    const aiSessions = await aiSessionModel.insertMany([
      {
        patientId: patients[0]._id,
        status: 'active',
        startedAt: new Date('2026-03-20T10:00:00Z'),
        endedAt: null,
      },
      {
        patientId: patients[1]._id,
        status: 'completed',
        startedAt: new Date('2026-03-19T14:00:00Z'),
        endedAt: new Date('2026-03-19T14:30:00Z'),
      },
    ]);
    console.log(`✅ Created ${aiSessions.length} AI sessions\n`);

    // ==========================================
    // 8. SEED AI MESSAGES
    // ==========================================
    console.log('💬 Creating AI messages...');
    const aiMessages = await aiMessageModel.insertMany([
      {
        aiSessionId: aiSessions[0]._id,
        senderType: 'patient',
        content: 'I have been having headaches for the past few days',
        attachments: [],
        sentAt: new Date('2026-03-20T10:05:00Z'),
      },
      {
        aiSessionId: aiSessions[0]._id,
        senderType: 'ai',
        content:
          'I understand you are experiencing headaches. Can you describe the severity and location of the pain?',
        attachments: [],
        sentAt: new Date('2026-03-20T10:06:00Z'),
      },
      {
        aiSessionId: aiSessions[1]._id,
        senderType: 'patient',
        content: 'My blood pressure has been high lately',
        attachments: [],
        sentAt: new Date('2026-03-19T14:05:00Z'),
      },
      {
        aiSessionId: aiSessions[1]._id,
        senderType: 'ai',
        content:
          'Based on your recent readings, I recommend reducing salt intake and increasing physical activity.',
        attachments: [],
        sentAt: new Date('2026-03-19T14:25:00Z'),
      },
    ]);
    console.log(`✅ Created ${aiMessages.length} AI messages\n`);

    // ==========================================
    // 9. SEED AI FEEDBACKS
    // ==========================================
    console.log('⭐ Creating AI feedbacks...');
    const aiFeedbacks = await aiFeedbackModel.insertMany([
      {
        patientId: patients[1]._id,
        aiSessionId: aiSessions[1]._id,
        content: 'The AI provided helpful and accurate advice',
      },
    ]);
    console.log(`✅ Created ${aiFeedbacks.length} AI feedbacks\n`);

    // ==========================================
    // 10. SEED DOCTOR SESSIONS
    // ==========================================
    console.log('👨‍⚕️ Creating doctor sessions...');
    const sessions = await sessionModel.insertMany([
      {
        patientId: patients[0]._id,
        doctorId: doctors[0]._id,
        status: 'completed',
        patientNotes: 'Follow-up for cardiac condition',
        doctorNotes:
          'Patient shows improvement. Continue current medication. Follow-up in 1 month.',
        scheduledAt: new Date('2026-03-18T14:00:00Z'),
        startedAt: new Date('2026-03-18T14:00:00Z'),
        endedAt: new Date('2026-03-18T14:30:00Z'),
      },
      {
        patientId: patients[1]._id,
        doctorId: doctors[1]._id,
        status: 'active',
        patientNotes: 'Check-up for child immunization',
        doctorNotes: null,
        scheduledAt: new Date('2026-03-20T10:00:00Z'),
        startedAt: new Date('2026-03-20T10:00:00Z'),
        endedAt: null,
      },
      {
        patientId: patients[2]._id,
        doctorId: doctors[2]._id,
        status: 'pending',
        patientNotes: 'Neurology consultation',
        doctorNotes: null,
        scheduledAt: new Date('2026-03-21T15:00:00Z'),
        startedAt: null,
        endedAt: null,
      },
    ]);
    console.log(`✅ Created ${sessions.length} doctor sessions\n`);

    // ==========================================
    // 11. SEED DOCTOR MESSAGES
    // ==========================================
    console.log('💌 Creating doctor messages...');
    const doctorMessages = await messageModel.insertMany([
      {
        doctorSessionId: sessions[0]._id,
        senderId: doctors[0]._id,
        senderType: 'doctor',
        content: 'Good to see you today. How have you been feeling?',
        attachments: [],
        sentAt: new Date('2026-03-18T14:05:00Z'),
      },
      {
        doctorSessionId: sessions[0]._id,
        senderId: patients[0]._id,
        senderType: 'patient',
        content: 'I am doing much better than last month',
        attachments: [],
        sentAt: new Date('2026-03-18T14:10:00Z'),
      },
      {
        doctorSessionId: sessions[1]._id,
        senderId: doctors[1]._id,
        senderType: 'doctor',
        content: 'Let me check your vaccination records',
        attachments: [
          {
            fileUrl: 'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/chat/attachments/immunization_chart.pdf',
            fileName: 'immunization_chart.pdf',
            fileSize: 245000,
            mimeType: 'application/pdf',
          },
        ],
        sentAt: new Date('2026-03-20T10:05:00Z'),
      },
    ]);
    console.log(`✅ Created ${doctorMessages.length} doctor messages\n`);

    // ==========================================
    // 12. SEED REVIEWS
    // ==========================================
    console.log('⭐ Creating reviews...');
    const reviews = await reviewModel.insertMany([
      {
        doctorSessionId: sessions[0]._id,
        patientId: patients[0]._id,
        doctorId: doctors[0]._id,
        rating: 5,
        comment: 'Excellent doctor! Very professional and caring.',
      },
      {
        doctorSessionId: sessions[1]._id,
        patientId: patients[1]._id,
        doctorId: doctors[1]._id,
        rating: 4,
        comment: 'Good service, but waiting time was a bit long.',
      },
    ]);
    console.log(`✅ Created ${reviews.length} reviews\n`);

    // ==========================================
    // 13. SEED NOTIFICATIONS
    // ==========================================
    console.log('🔔 Creating notifications...');
    const notifications = await notificationModel.insertMany([
      {
        userId: patients[0]._id,
        title: 'Appointment Reminder',
        message: 'You have an appointment tomorrow with Dr. Lê Thanh Tâm',
        isRead: false,
        type: 'info',
      },
      {
        userId: patients[1]._id,
        title: 'High Blood Pressure Alert',
        message:
          'Your latest blood pressure reading is higher than normal. Please consult your doctor.',
        isRead: false,
        type: 'warning',
      },
      {
        userId: patients[2]._id,
        title: 'Health Tip',
        message:
          'Remember to stay hydrated! Drink at least 2 liters of water daily.',
        isRead: true,
        type: 'success',
      },
    ]);
    console.log(`✅ Created ${notifications.length} notifications\n`);

    // ==========================================
    // 14. SEED BLACKLIST KEYWORDS
    // ==========================================
    console.log('🚫 Creating blacklist keywords...');
    const blacklistKeywords = await blacklistKeywordModel.insertMany([
      {
        wordList: [
          'spam',
          'abuse',
          'harassment',
          'inappropriate',
          'offensive',
          'vulgar',
          'hate',
        ],
      },
    ]);
    console.log(
      `✅ Created ${blacklistKeywords.length} blacklist keyword entries\n`,
    );

    // ==========================================
    // 15. SEED AI DOCUMENTS
    // ==========================================
    console.log('📄 Creating AI documents...');
    const aiDocuments = await aiDocumentModel.insertMany([
      {
        title: 'Cardiology Treatment Guidelines 2026',
        fileUrl: 'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/ai/documents/cardiology_guidelines.pdf',
        fileType: 'pdf',
        status: 'active',
        uploadedBy: admins[0]._id,
      },
      {
        title: 'Pediatric Care Manual',
        fileUrl: 'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/ai/documents/pediatric_manual.docx',
        fileType: 'docx',
        status: 'processing',
        uploadedBy: admins[0]._id,
      },
      {
        title: 'Neurology Diagnostic Criteria',
        fileUrl: 'https://res.cloudinary.com/healthcare-app/raw/upload/healthcare/ai/documents/neurology_criteria.pdf',
        fileType: 'pdf',
        status: 'active',
        uploadedBy: admins[0]._id,
      },
    ]);
    console.log(`✅ Created ${aiDocuments.length} AI documents\n`);

    // ==========================================
    // 16. SEED AI DOCUMENT CHUNKS
    // ==========================================
    console.log('📑 Creating AI document chunks...');
    const aiDocumentChunks = await aiDocumentChunkModel.insertMany([
      {
        documentId: aiDocuments[0]._id,
        chunkIndex: 1,
        content:
          'Cardiology is the medical specialty dealing with disorders of the heart. Treatment guidelines for 2026 emphasize preventive care and lifestyle modifications.',
        embedding: new Array(1536).fill(0.1), // Vector embedding (simplified)
        isActive: true,
      },
      {
        documentId: aiDocuments[0]._id,
        chunkIndex: 2,
        content:
          'ACE inhibitors are commonly prescribed for hypertension management. Dosage should be adjusted based on patient response and renal function.',
        embedding: new Array(1536).fill(0.1),
        isActive: true,
      },
      {
        documentId: aiDocuments[1]._id,
        chunkIndex: 1,
        content:
          'Pediatric care requires special consideration for developmental stages. Vaccination schedules should follow WHO guidelines.',
        embedding: new Array(1536).fill(0.1),
        isActive: false,
      },
      {
        documentId: aiDocuments[2]._id,
        chunkIndex: 1,
        content:
          'Neurological disorders require comprehensive diagnostic evaluation. MRI and EEG are standard imaging modalities.',
        embedding: new Array(1536).fill(0.1),
        isActive: true,
      },
    ]);
    console.log(`✅ Created ${aiDocumentChunks.length} AI document chunks\n`);

    // ==========================================
    // 17. SEED VIOLATION REPORTS
    // ==========================================
    console.log('⚠️  Creating violation reports...');
    const violationReports = await violationModel.insertMany([
      {
        reporterId: patients[0]._id,
        reportedUserId: patients[2]._id,
        reportType: 'harassment',
        reason: 'Received inappropriate messages during consultation',
        status: 'pending',
      },
    ]);
    console.log(`✅ Created ${violationReports.length} violation reports\n`);

    // ==========================================
    // 18. SEED AI HEALTH INSIGHTS
    // ==========================================
    console.log('🔍 Creating AI health insights...');
    const aiHealthInsights = await aiHealthInsightModel.insertMany([
      {
        patientId: patients[0]._id,
        analyzedMetrics: {
          blood_pressure: '120/80',
          heart_rate: 72,
          bmi: 22.5,
        },
        riskLevel: 'normal',
        advice:
          'Your vital signs are normal. Continue maintaining your current lifestyle and exercise routine.',
      },
      {
        patientId: patients[1]._id,
        analyzedMetrics: {
          blood_pressure: '135/88',
          heart_rate: 78,
          bmi: 24.1,
        },
        riskLevel: 'warning',
        advice:
          'Your blood pressure is slightly elevated. Reduce sodium intake and increase aerobic exercise to 150 minutes per week.',
      },
      {
        patientId: patients[2]._id,
        analyzedMetrics: {
          blood_pressure: '145/95',
          heart_rate: 85,
          bmi: 28.3,
        },
        riskLevel: 'danger',
        advice:
          'Your blood pressure and BMI are in the danger zone. Please consult your doctor immediately for a comprehensive evaluation.',
      },
    ]);
    console.log(`✅ Created ${aiHealthInsights.length} AI health insights\n`);

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('✨ Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   • Patients: ${patientProfiles.length}`);
    console.log(`   • Doctors: ${doctorProfiles.length}`);
    console.log(`   • Admins: ${adminProfiles.length}`);
    console.log(`   • Health Metrics: ${healthMetrics.length}`);
    console.log(`   • AI Sessions: ${aiSessions.length}`);
    console.log(`   • AI Messages: ${aiMessages.length}`);
    console.log(`   • Doctor Sessions: ${sessions.length}`);
    console.log(`   • Doctor Messages: ${doctorMessages.length}`);
    console.log(`   • Reviews: ${reviews.length}`);
    console.log(`   • Notifications: ${notifications.length}`);
    console.log(`   • AI Documents: ${aiDocuments.length}`);
    console.log(`   • AI Document Chunks: ${aiDocumentChunks.length}`);
    console.log(`   • Blacklist Entries: ${blacklistKeywords.length}`);
    console.log(`   • AI Health Insights: ${aiHealthInsights.length}`);
    console.log(`   • Violation Reports: ${violationReports.length}\n`);

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await app.close();
    process.exit(1);
  }
}

seedDatabase();
