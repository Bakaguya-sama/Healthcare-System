import { CareAlertSchema } from './care-alert.entity';

describe('CareAlert persistence indexes', () => {
  it('keeps evaluation and dedupe keys unique', () => {
    expect(CareAlertSchema.indexes()).toContainEqual([
      { evaluationId: 1 },
      expect.objectContaining({ name: 'evaluationId_1', unique: true }),
    ]);
    expect(CareAlertSchema.indexes()).toContainEqual([
      { uniqueKey: 1 },
      expect.objectContaining({ name: 'uniqueKey_1', unique: true }),
    ]);
  });

  it('supports the doctor inbox sort without a collection scan', () => {
    expect(CareAlertSchema.indexes()).toContainEqual([
      { assignedDoctorId: 1, severity: -1, detectedAt: -1, _id: -1 },
      expect.objectContaining({
        name: 'assignedDoctorId_1_severity_-1_detectedAt_-1__id_-1',
      }),
    ]);
  });
});
