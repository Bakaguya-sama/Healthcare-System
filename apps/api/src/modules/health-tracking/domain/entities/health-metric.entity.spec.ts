import { HealthMetricSchema } from './health-metric.entity';
import {
  HEALTH_METRIC_COLLECTION,
  HEALTH_METRIC_INDEXES,
} from '../../../../database/migrations/202610061200-health-metric-contract-alignment';

describe('HealthMetric persistence contract', () => {
  it('declares the approved target fields including explicit timestamps', () => {
    const paths = Object.keys(HealthMetricSchema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '_id',
        'meta',
        'values',
        'source',
        'sourceRef',
        'validationStatus',
        'validationReasonCodes',
        'recordedTimezone',
        'replacesMetricId',
        'recordedAt',
        'ingestedAt',
        'voidedAt',
        'voidedBy',
        'voidReason',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining(['patientId', 'type', 'unit', 'timezone']),
    );
  });

  it('keeps Mongoose index definitions aligned with the migration', () => {
    const mongooseIndexes = new Map(
      HealthMetricSchema.indexes().map(([key, options]) => [
        String(options.name),
        { key, unique: options.unique, sparse: options.sparse },
      ]),
    );
    for (const index of HEALTH_METRIC_INDEXES)
      expect(mongooseIndexes.get(index.name)).toEqual({
        key: index.key,
        unique: 'unique' in index ? index.unique : undefined,
        sparse: 'sparse' in index ? index.sparse : undefined,
      });
  });

  it('keeps required migration fields present in the Mongoose schema', () => {
    const required = HEALTH_METRIC_COLLECTION.validator.$jsonSchema.required;
    for (const field of required)
      expect(HealthMetricSchema.path(field)).toBeDefined();
  });
});
