import { CareProgramSchema } from './care-program.entity';
import { CareRuleSchema } from './care-rule.entity';
import { PatientCareProgramSchema } from './patient-care-program.entity';

describe('chronic-care persistence indexes', () => {
  it('keeps program and rule versions unique', () => {
    expect(CareProgramSchema.indexes()).toContainEqual([
      { programCode: 1, version: 1 },
      expect.objectContaining({
        name: 'programCode_1_version_1',
        unique: true,
      }),
    ]);
    expect(CareRuleSchema.indexes()).toContainEqual([
      { careProgramId: 1, version: 1 },
      expect.objectContaining({
        name: 'careProgramId_1_version_1',
        unique: true,
      }),
    ]);
  });

  it('allows at most one active rule per program version', () => {
    expect(CareRuleSchema.indexes()).toContainEqual([
      { careProgramId: 1 },
      expect.objectContaining({
        name: 'careProgramId_active_unique',
        unique: true,
        partialFilterExpression: { status: 'active' },
      }),
    ]);
  });

  it('prevents duplicate non-terminal enrollments for a patient and program', () => {
    expect(PatientCareProgramSchema.indexes()).toContainEqual([
      { patientId: 1, careProgramId: 1 },
      expect.objectContaining({
        name: 'patientId_1_careProgramId_active_unique',
        unique: true,
        partialFilterExpression: {
          status: { $in: ['pending', 'active', 'paused'] },
        },
      }),
    ]);
  });
});
