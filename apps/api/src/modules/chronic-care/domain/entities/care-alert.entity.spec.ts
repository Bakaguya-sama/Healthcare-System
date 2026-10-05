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
});
