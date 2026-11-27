import type { Db } from 'mongodb';
import { withDatabase } from './seed-utils';

export const REFERENCE_BLACKLIST_KEYWORDS = [
  'spam',
  'scam',
  'fraud',
  'harassment',
] as const;

export const STANDARD_CARE_CONTENTS = [
  {
    contentId: 'hypertension_salt_guide',
    version: 'v1.0',
    locale: 'vi',
    displayType: 'article',
    status: 'published',
    title: 'Hướng dẫn giảm muối và dinh dưỡng cho người tăng huyết áp',
    summary:
      'Chế độ ăn giảm natri dưới 2.000 mg mỗi ngày, tăng cường rau xanh và đo huyết áp định kỳ.',
  },
  {
    contentId: 'bp_home_measurement_video',
    version: 'v1.0',
    locale: 'vi',
    displayType: 'video',
    status: 'published',
    title: 'Video hướng dẫn tư thế đo huyết áp chuẩn tại nhà',
    summary:
      'Nghỉ ngơi 5 phút trước khi đo, đặt vòng bít ngang mức tim và không nói chuyện trong lúc đo.',
  },
  {
    contentId: 'diabetes_foot_care_doc',
    version: 'v1.0',
    locale: 'vi',
    displayType: 'document',
    status: 'published',
    title: 'Tài liệu chăm sóc bàn chân và phòng ngừa biến chứng đái tháo đường',
    summary:
      'Kiểm tra bàn chân mỗi tối, giữ da khô thoáng và liên hệ bác sĩ ngay khi có vết xước lâu lành.',
  },
] as const;

export async function seedStandardCareContents(db: Db): Promise<void> {
  const now = new Date();
  await db.collection('carecontents').bulkWrite(
    STANDARD_CARE_CONTENTS.map((item) => ({
      updateOne: {
        filter: {
          contentId: item.contentId,
          version: item.version,
          locale: item.locale,
          displayType: item.displayType,
        },
        update: {
          $setOnInsert: {
            ...item,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
  );
}

export async function seedReferenceData(db: Db): Promise<void> {
  const collection = db.collection<{ keyword: string }>('blacklistkeywords');
  await collection.createIndex(
    { keyword: 1 },
    { name: 'keyword_1', unique: true },
  );
  await collection.bulkWrite(
    REFERENCE_BLACKLIST_KEYWORDS.map((keyword) => ({
      updateOne: {
        filter: { keyword },
        update: { $setOnInsert: { keyword } },
        upsert: true,
      },
    })),
  );
  await seedStandardCareContents(db);
}

if (require.main === module) {
  void withDatabase(seedReferenceData)
    .then(() => console.log('reference seed applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
