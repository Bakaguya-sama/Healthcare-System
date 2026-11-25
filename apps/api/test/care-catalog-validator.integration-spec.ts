import { randomBytes } from 'node:crypto';
import { Double, Int32, Long, MongoClient, ObjectId } from 'mongodb';
import {
  applyCareCatalogNumericVersionValidator,
  CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR,
  CARE_RULE_NUMERIC_VERSION_VALIDATOR,
} from '../src/database/migrations/202611251000-care-catalog-numeric-version-validator';

describe('Care Catalog numeric validator migration integration', () => {
  const client = new MongoClient(
    process.env.TEST_MONGODB_URI ??
      'mongodb://127.0.0.1:27018/admin?replicaSet=rs0&directConnection=true',
    { serverSelectionTimeoutMS: 5_000 },
  );
  const dbName = `healthcare_mergefix_${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    await client.connect();
    await client.db(dbName).createCollection('careprograms');
    await client.db(dbName).createCollection('carerules');
  });

  afterAll(async () => {
    if (/^healthcare_mergefix_[a-f0-9]{8}$/.test(dbName))
      await client.db(dbName).dropDatabase();
    await client.close();
  });

  it('applies and re-applies forward-only collMod, then accepts all three BSON numeric types', async () => {
    const db = client.db(dbName);
    await applyCareCatalogNumericVersionValidator(db);
    await applyCareCatalogNumericVersionValidator(db);

    const program = db.collection('careprograms');
    const rule = db.collection('carerules');
    for (const [index, version] of [
      new Int32(1),
      Long.fromNumber(2),
      new Double(3),
    ].entries()) {
      const now = new Date();
      const careProgramId = new ObjectId();
      await program.insertOne({
        programCode: `SYNTH-${index}`,
        version,
        name: 'Synthetic test program',
        diseaseKey: 'synthetic',
        status: 'draft',
        baselineForm: { schemaVersion: 'v1', fields: [] },
        taskTemplates: [],
        reminderPolicy: {},
        dataSources: [],
        createdBy: new ObjectId(),
        createdAt: now,
        updatedAt: now,
      });
      await rule.insertOne({
        careProgramId,
        version,
        status: 'draft',
        rules: [],
        createdBy: new ObjectId(),
        createdAt: now,
        updatedAt: now,
      });
    }

    await expect(
      program.insertOne({
        programCode: 'SYNTH-INVALID',
        version: new Int32(0),
        name: 'Synthetic invalid version',
        diseaseKey: 'synthetic',
        status: 'draft',
        baselineForm: { schemaVersion: 'v1', fields: [] },
        taskTemplates: [],
        reminderPolicy: {},
        dataSources: [],
        createdBy: new ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow();

    const programInfo = (await db
      .listCollections({ name: 'careprograms' }, { nameOnly: false })
      .next()) as { options?: { validator?: unknown } } | null;
    const ruleInfo = (await db
      .listCollections({ name: 'carerules' }, { nameOnly: false })
      .next()) as { options?: { validator?: unknown } } | null;
    expect(programInfo?.options?.validator).toEqual(CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR);
    expect(ruleInfo?.options?.validator).toEqual(CARE_RULE_NUMERIC_VERSION_VALIDATOR);
    expect(await program.countDocuments()).toBe(3);
    expect(await rule.countDocuments()).toBe(3);
  });
});
