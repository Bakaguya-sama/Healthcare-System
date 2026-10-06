import { MongoClient, ObjectId } from 'mongodb';
import {
  applyHealthMetricContractAlignment,
  HEALTH_METRIC_COLLECTION,
} from '../src/database/migrations/202610061200-health-metric-contract-alignment';

const mongoUri =
  process.env.TEST_MONGODB_URI ??
  'mongodb://127.0.0.1:27018/healthcare_health_metric_contract?replicaSet=rs0&directConnection=true';

describe('HealthMetric target persistence contract', () => {
  let client: MongoClient;

  beforeAll(async () => {
    client = new MongoClient(mongoUri);
    await client.connect();
  });

  beforeEach(async () => {
    await client.db().dropDatabase();
  });

  afterAll(async () => {
    await client.db().dropDatabase();
    await client.close();
  });

  it('backfills legacy documents, installs the validator and replaces indexes', async () => {
    const db = client.db();
    const patientId = new ObjectId();
    const recordedAt = new Date('2026-10-01T01:00:00.000Z');
    await db.createCollection('healthmetrics');
    await db
      .collection('healthmetrics')
      .createIndex(
        { patientId: 1, type: 1, recordedAt: -1, _id: -1 },
        { name: 'patientId_1_type_1_recordedAt_-1__id_-1' },
      );
    await db.collection('healthmetrics').insertOne({
      patientId,
      type: 'blood_pressure',
      unit: 'mmHg',
      values: {
        systolic: { value: 120, recordedAt },
        diastolic: { value: 80, recordedAt },
      },
      source: 'manual',
      timezone: 'Asia/Ho_Chi_Minh',
      recordedAt,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    });

    await applyHealthMetricContractAlignment(db);

    const migrated = await db.collection('healthmetrics').findOne({});
    expect(migrated).toMatchObject({
      meta: { patientId, metricType: 'blood_pressure', unit: 'mmHg' },
      values: { systolic: 120, diastolic: 80 },
      validationStatus: 'valid',
      validationReasonCodes: [],
      recordedTimezone: 'Asia/Ho_Chi_Minh',
      ingestedAt: recordedAt,
    });
    expect(migrated).not.toHaveProperty('patientId');
    expect(migrated).not.toHaveProperty('type');
    expect(migrated).not.toHaveProperty('unit');
    expect(migrated).not.toHaveProperty('timezone');

    const names = (await db.collection('healthmetrics').listIndexes().toArray())
      .map((index) => index.name)
      .sort();
    expect(names).toEqual(
      expect.arrayContaining([
        'meta.patientId_1_recordedAt_-1__id_-1',
        'meta.patientId_1_meta.metricType_1_recordedAt_-1__id_-1',
        'replacesMetricId_1',
      ]),
    );
    expect(names).not.toContain('patientId_1_type_1_recordedAt_-1__id_-1');

    await expect(
      db.collection('healthmetrics').insertOne({
        patientId,
        type: 'heart_rate',
        values: { value: 70 },
      }),
    ).rejects.toThrow();
    const collectionInfo = await db
      .listCollections({ name: HEALTH_METRIC_COLLECTION.name })
      .next();
    const options = (collectionInfo as { options?: { validator?: unknown } })
      ?.options;
    expect(options?.validator).toEqual(HEALTH_METRIC_COLLECTION.validator);
  });
});
