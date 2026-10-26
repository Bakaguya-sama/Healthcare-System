import { MongoClient } from 'mongodb';
import { loadDatabaseEnvironment } from '../database/load-database-environment';

async function main() {
  loadDatabaseEnvironment();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const counts = await client
      .db()
      .collection('consultations')
      .aggregate([
        {
          $match: {
            requestStatus: 'accepted',
            sessionStatus: {
              $in: [
                'waiting',
                'in_consultation',
                'completed',
                'no_show',
                'interrupted',
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'consultationusages',
            localField: '_id',
            foreignField: 'consultationId',
            as: 'usage',
          },
        },
        { $match: { usage: { $size: 0 } } },
        { $group: { _id: '$sessionStatus', count: { $sum: 1 } } },
      ])
      .toArray();
    const exemptWaiting = await client
      .db()
      .collection('consultations')
      .countDocuments({
        requestStatus: 'accepted',
        sessionStatus: 'waiting',
        legacyQuotaExempt: true,
      });
    const auditedExempt = await client
      .db()
      .collection('consultations')
      .aggregate([
        {
          $match: {
            requestStatus: 'accepted',
            sessionStatus: 'waiting',
            legacyQuotaExempt: true,
          },
        },
        {
          $lookup: {
            from: 'auditlogs',
            let: { consultationId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$entityId', '$$consultationId'] },
                      {
                        $eq: ['$action', 'legacy_consultation_quota_exempted'],
                      },
                    ],
                  },
                },
              },
            ],
            as: 'audit',
          },
        },
        { $match: { 'audit.0': { $exists: true } } },
        { $count: 'count' },
      ])
      .toArray();
    console.log(
      JSON.stringify({
        acceptedWithoutLedgerByStatus: Object.fromEntries(
          counts.map((row) => [String(row._id), row.count]),
        ),
        exemptWaiting,
        exemptWaitingWithAudit: auditedExempt[0]?.count ?? 0,
      }),
    );
    if (process.argv.includes('--list-waiting')) {
      const waiting = await client
        .db()
        .collection('consultations')
        .aggregate([
          {
            $match: {
              requestStatus: 'accepted',
              sessionStatus: 'waiting',
              legacyQuotaExempt: { $ne: true },
            },
          },
          {
            $lookup: {
              from: 'consultationusages',
              localField: '_id',
              foreignField: 'consultationId',
              as: 'usage',
            },
          },
          { $match: { usage: { $size: 0 } } },
          { $project: { _id: 1 } },
        ])
        .toArray();
      console.log(
        JSON.stringify({ waitingIds: waiting.map((item) => String(item._id)) }),
      );
    }
    if (process.argv.includes('--inspect-waiting-types')) {
      const waiting = await client
        .db()
        .collection('consultations')
        .aggregate([
          {
            $match: {
              requestStatus: 'accepted',
              sessionStatus: 'waiting',
              legacyQuotaExempt: { $ne: true },
            },
          },
          {
            $lookup: {
              from: 'consultationusages',
              localField: '_id',
              foreignField: 'consultationId',
              as: 'usage',
            },
          },
          { $match: { usage: { $size: 0 } } },
          {
            $project: {
              fields: {
                $map: {
                  input: { $objectToArray: '$$ROOT' },
                  as: 'field',
                  in: { name: '$$field.k', type: { $type: '$$field.v' } },
                },
              },
            },
          },
        ])
        .toArray();
      console.log(JSON.stringify({ waitingTypes: waiting }));
    }
  } finally {
    await client.close();
  }
}

void main();
