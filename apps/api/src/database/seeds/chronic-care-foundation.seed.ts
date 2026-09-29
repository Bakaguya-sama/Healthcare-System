import { ObjectId, type Db } from 'mongodb';
import { withDatabase } from './seed-utils';

export type ChronicCareFoundationSeedInput = {
  createdBy: ObjectId;
  programCode?: string;
  diseaseKey?: string;
};

/**
 * This is a deterministic catalog fixture for local development only. Runtime
 * publishing and activation must use the audited command handlers.
 */
export async function seedChronicCareFoundation(
  db: Db,
  input: ChronicCareFoundationSeedInput,
): Promise<{ careProgramId: ObjectId; careRuleId: ObjectId }> {
  const now = new Date();
  const programCode = input.programCode ?? 'demo-hypertension';
  const diseaseKey = input.diseaseKey ?? 'hypertension';
  const programResult = await db.collection('careprograms').findOneAndUpdate(
    { programCode, version: 1 },
    {
      $setOnInsert: {
        programCode,
        version: 1,
        name: 'Demo hypertension care program',
        diseaseKey,
        status: 'published',
        revision: 1,
        eligibilityForm: { all: [] },
        baselineForm: { fields: [] },
        taskTemplates: [],
        reminderPolicy: { channels: [] },
        dataSources: [],
        createdBy: input.createdBy,
        publishedBy: input.createdBy,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!programResult)
    throw new Error('could not create chronic-care seed program');

  const careProgramId = programResult._id as ObjectId;
  const ruleResult = await db.collection('carerules').findOneAndUpdate(
    { careProgramId, version: 1 },
    {
      $setOnInsert: {
        careProgramId,
        version: 1,
        status: 'active',
        revision: 1,
        rules: [{ operator: 'all' }],
        dataSources: [],
        createdBy: input.createdBy,
        activatedBy: input.createdBy,
        activatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!ruleResult) throw new Error('could not create chronic-care seed rule');

  return { careProgramId, careRuleId: ruleResult._id as ObjectId };
}

if (require.main === module) {
  const createdBy = process.env.CHRONIC_CARE_SEED_CREATED_BY;
  if (!createdBy || !ObjectId.isValid(createdBy)) {
    throw new Error('CHRONIC_CARE_SEED_CREATED_BY must be a valid ObjectId');
  }
  void withDatabase(async (db) => {
    await seedChronicCareFoundation(db, { createdBy: new ObjectId(createdBy) });
  })
    .then(() => console.log('chronic-care foundation seed applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
