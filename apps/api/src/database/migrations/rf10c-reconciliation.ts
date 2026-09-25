import type { Db, Document } from 'mongodb';

export type Rf10cReconciliationReport = {
  generatedAt: string;
  legacyDocuments: {
    sessions: number;
    aiSessions: number;
    aiMessages: number;
    aiHealthInsights: number;
  };
  blockers: {
    sessionsWithoutConsultation: number;
    aiSessionsWithoutConversation: number;
    aiMessagesWithoutCanonicalMessage: number;
    messagesWithoutConsultationId: number;
    reviewsWithoutConsultationId: number;
    aiFeedbacksWithoutConversationId: number;
  };
  ready: boolean;
};

async function collectionExists(db: Db, name: string): Promise<boolean> {
  return await db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function count(db: Db, collection: string): Promise<number> {
  if (!(await collectionExists(db, collection))) return 0;
  return db.collection(collection).countDocuments();
}

async function countWithoutLookup(
  db: Db,
  source: string,
  target: string,
  localField: string,
  foreignField: string,
): Promise<number> {
  if (!(await collectionExists(db, source))) return 0;
  if (!(await collectionExists(db, target))) return count(db, source);
  const result = await db
    .collection(source)
    .aggregate<{ total: number }>([
      {
        $lookup: {
          from: target,
          localField,
          foreignField,
          as: '__canonical',
        },
      },
      { $match: { '__canonical.0': { $exists: false } } },
      { $count: 'total' },
    ])
    .next();
  return result?.total ?? 0;
}

async function countLegacyAiMessagesWithoutCanonical(db: Db): Promise<number> {
  if (!(await collectionExists(db, 'aimessages'))) return 0;
  if (!(await collectionExists(db, 'aiconversationmessages'))) {
    return count(db, 'aimessages');
  }
  const result = await db
    .collection('aimessages')
    .aggregate<{ total: number }>([
      {
        $lookup: {
          from: 'aiconversationmessages',
          let: {
            sourceKey: {
              $concat: [
                'session:',
                { $toString: '$aiSessionId' },
                ':',
                { $toString: '$_id' },
              ],
            },
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$legacySourceKey', '$$sourceKey'] },
              },
            },
          ],
          as: '__canonical',
        },
      },
      { $match: { '__canonical.0': { $exists: false } } },
      { $count: 'total' },
    ])
    .next();
  return result?.total ?? 0;
}

async function countMissingCanonicalField(
  db: Db,
  collection: string,
  legacyField: string,
  canonicalField: string,
): Promise<number> {
  if (!(await collectionExists(db, collection))) return 0;
  return db.collection(collection).countDocuments({
    [legacyField]: { $exists: true },
    [canonicalField]: { $exists: false },
  } as Document);
}

export async function reconcileRf10c(
  db: Db,
): Promise<Rf10cReconciliationReport> {
  const [
    sessions,
    aiSessions,
    aiMessages,
    aiHealthInsights,
    sessionsWithoutConsultation,
    aiSessionsWithoutConversation,
    aiMessagesWithoutCanonicalMessage,
    messagesWithoutConsultationId,
    reviewsWithoutConsultationId,
    aiFeedbacksWithoutConversationId,
  ] = await Promise.all([
    count(db, 'sessions'),
    count(db, 'aisessions'),
    count(db, 'aimessages'),
    count(db, 'aihealthinsights'),
    countWithoutLookup(db, 'sessions', 'consultations', '_id', '_id'),
    countWithoutLookup(
      db,
      'aisessions',
      'aiconversations',
      '_id',
      'legacyAiSessionId',
    ),
    countLegacyAiMessagesWithoutCanonical(db),
    countMissingCanonicalField(
      db,
      'messages',
      'doctorSessionId',
      'consultationId',
    ),
    countMissingCanonicalField(
      db,
      'reviews',
      'doctorSessionId',
      'consultationId',
    ),
    countMissingCanonicalField(
      db,
      'aifeedbacks',
      'aiSessionId',
      'aiConversationId',
    ),
  ]);

  const blockers = {
    sessionsWithoutConsultation,
    aiSessionsWithoutConversation,
    aiMessagesWithoutCanonicalMessage,
    messagesWithoutConsultationId,
    reviewsWithoutConsultationId,
    aiFeedbacksWithoutConversationId,
  };
  return {
    generatedAt: new Date().toISOString(),
    legacyDocuments: { sessions, aiSessions, aiMessages, aiHealthInsights },
    blockers,
    ready: Object.values(blockers).every((value) => value === 0),
  };
}

export function assertRf10cReady(report: Rf10cReconciliationReport): void {
  if (report.ready) return;
  const failures = Object.entries(report.blockers)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`)
    .join(', ');
  throw new Error(`RF-10C reconciliation failed: ${failures}`);
}
