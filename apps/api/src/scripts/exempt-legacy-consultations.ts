import { MongoClient, ObjectId } from 'mongodb';
import { loadDatabaseEnvironment } from '../database/load-database-environment';

/** Only explicit, individually reviewed IDs can be exempted; no automatic backfill. */
export async function exemptLegacyConsultations(
  client: MongoClient,
  ids: string[],
) {
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !ObjectId.isValid(id))
  )
    throw new Error('Provide distinct consultation IDs');
  const db = client.db();
  const session = client.startSession();
  try {
    let marked = 0;
    await session.withTransaction(async () => {
      marked = 0;
      for (const id of ids) {
        const objectId = new ObjectId(id);
        const consultation = await db
          .collection('consultations')
          .findOne({ _id: objectId }, { session });
        if (
          !consultation ||
          consultation.requestStatus !== 'accepted' ||
          consultation.sessionStatus !== 'waiting'
        )
          throw new Error(
            `Consultation ${id} is not an accepted waiting booking`,
          );
        const existingUsage = await db
          .collection('consultationusages')
          .findOne({ consultationId: objectId }, { session });
        if (existingUsage)
          throw new Error(`Consultation ${id} has a quota ledger`);
        if (consultation.legacyQuotaExempt === true) continue;
        // Old documents may have explicit nulls where the current schema
        // requires an absent field or a date. Normalize only known nulls.
        const unset: Record<string, ''> = {};
        if (consultation.completedAt === null) unset.completedAt = '';
        if (consultation.sessionStartedAt === null) unset.sessionStartedAt = '';
        const result = await db.collection('consultations').updateOne(
          {
            _id: objectId,
            requestStatus: 'accepted',
            sessionStatus: 'waiting',
            legacyQuotaExempt: { $ne: true },
          },
          {
            $set: { legacyQuotaExempt: true, updatedAt: new Date() },
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          },
          { session },
        );
        if (result.modifiedCount !== 1)
          throw new Error(`Consultation ${id} changed concurrently`);
        await db.collection('auditlogs').insertOne(
          {
            domain: 'billing',
            entityType: 'consultation',
            entityId: objectId,
            userId: consultation.patientId,
            action: 'legacy_consultation_quota_exempted',
            reason: 'pre_cc013_booking',
            metadata: { normalizedNullFields: Object.keys(unset) },
            createdAt: new Date(),
          },
          { session },
        );
        marked++;
      }
    });
    return marked;
  } finally {
    await session.endSession();
  }
}

async function main() {
  loadDatabaseEnvironment();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const ids = (process.env.CC013_LEGACY_CONSULTATION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log(
      JSON.stringify({ marked: await exemptLegacyConsultations(client, ids) }),
    );
  } finally {
    await client.close();
  }
}

if (require.main === module) void main();
