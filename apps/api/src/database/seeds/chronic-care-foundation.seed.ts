import { ObjectId, type Db } from 'mongodb';
import {
  findStandardCareProgram,
  STANDARD_CARE_PROGRAMS,
  type StandardCareProgram,
} from '../../modules/chronic-care/domain/catalog/standard-care-programs';
import { withDatabase } from './seed-utils';

export type ChronicCareFoundationSeedInput = {
  createdBy: ObjectId;
  programCode?: string;
};

/**
 * This is a deterministic catalog fixture for local development only. Runtime
 * publishing and activation must use the audited command handlers.
 */
export async function seedChronicCareFoundation(
  db: Db,
  input: ChronicCareFoundationSeedInput,
): Promise<{ careProgramId: ObjectId; careRuleId: ObjectId }> {
  const program = findStandardCareProgram(
    input.programCode ?? 'demo-hypertension',
  );
  if (!program)
    throw new Error(`unknown standard care program: ${input.programCode}`);
  return seedStandardCareProgram(db, input.createdBy, program);
}

/** Seeds both supported P0 programs. Safe to run repeatedly in local development. */
export async function seedChronicCareProgramCatalog(
  db: Db,
  createdBy: ObjectId,
): Promise<Record<string, { careProgramId: ObjectId; careRuleId: ObjectId }>> {
  const entries = await Promise.all(
    STANDARD_CARE_PROGRAMS.map(
      async (program) =>
        [
          program.programCode,
          await seedStandardCareProgram(db, createdBy, program),
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

async function seedStandardCareProgram(
  db: Db,
  createdBy: ObjectId,
  program: StandardCareProgram,
): Promise<{ careProgramId: ObjectId; careRuleId: ObjectId }> {
  const now = new Date();
  const programResult = await db.collection('careprograms').findOneAndUpdate(
    { programCode: program.programCode, version: 1 },
    {
      // These two catalog codes are reserved for local development fixtures.
      // Re-applying them deliberately converges old placeholder seed data to
      // the current deterministic configuration; production publishing uses
      // the audited command handlers instead.
      $set: {
        name: program.name,
        diseaseKey: program.diseaseKey,
        status: 'published',
        revision: 1,
        eligibilityForm: { all: [] },
        baselineForm: program.baselineForm,
        taskTemplates: program.taskTemplates,
        reminderPolicy: { channels: ['in_app'] },
        dataSources: [],
        publishedBy: createdBy,
        publishedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        programCode: program.programCode,
        version: 1,
        createdAt: now,
        createdBy,
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
      $set: {
        status: 'active',
        revision: 1,
        rules: program.rules,
        dataSources: [],
        activatedBy: createdBy,
        activatedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        careProgramId,
        version: 1,
        createdBy,
        createdAt: now,
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
    await seedChronicCareProgramCatalog(db, new ObjectId(createdBy));
  })
    .then(() => console.log('chronic-care program catalog seed applied'))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
