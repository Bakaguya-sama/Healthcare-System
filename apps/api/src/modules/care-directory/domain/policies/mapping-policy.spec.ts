import { chooseMapping, validateMapping } from './mapping-policy';

describe('disease/program specialty mapping policy', () => {
  it('prefers a Program-specific published mapping over a disease mapping', () => {
    type TestMapping = { scope: 'program' | 'disease'; scopeKey: string };
    const program: TestMapping = { scope: 'program', scopeKey: 'cc-program' };
    const disease: TestMapping = { scope: 'disease', scopeKey: 'hypertension' };
    expect(chooseMapping<TestMapping>({ programCode: 'cc-program', diseaseKey: 'hypertension', programMappings: [program], diseaseMappings: [disease] })).toEqual({ mapping: program, source: 'program_mapping' });
  });

  it('falls back to disease mapping and reports manual selection when neither exists', () => {
    type TestMapping = { scope: 'program' | 'disease'; scopeKey: string };
    const disease: TestMapping = { scope: 'disease', scopeKey: 'hypertension' };
    expect(chooseMapping<TestMapping>({ programCode: 'cc-program', diseaseKey: 'hypertension', programMappings: [], diseaseMappings: [disease] })).toEqual({ mapping: disease, source: 'disease_mapping' });
    expect(chooseMapping<TestMapping>({ programCode: 'cc-program', diseaseKey: 'hypertension', programMappings: [], diseaseMappings: [] })).toEqual({ mapping: null, source: null });
  });

  it('requires a valid, non-empty, duplicate-free specialty set', () => {
    expect(() => validateMapping('program', 'cc-program', ['cardiology'])).not.toThrow();
    expect(() => validateMapping('program', 'cc-program', [])).toThrow('MAPPING_SPECIALTIES_INVALID');
    expect(() => validateMapping('program', 'cc-program', ['cardiology', 'cardiology'])).toThrow('MAPPING_SPECIALTIES_INVALID');
  });
});
