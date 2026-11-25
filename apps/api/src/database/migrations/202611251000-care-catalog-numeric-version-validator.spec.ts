import {
  applyCareCatalogNumericVersionValidator,
  CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR,
  CARE_RULE_NUMERIC_VERSION_VALIDATOR,
} from './202611251000-care-catalog-numeric-version-validator';

describe('Care Catalog numeric-version validator migration', () => {
  it('allows BSON int, long and double without dropping the existing minimum', () => {
    for (const validator of [
      CARE_PROGRAM_NUMERIC_VERSION_VALIDATOR,
      CARE_RULE_NUMERIC_VERSION_VALIDATOR,
    ]) {
      const version = (validator.$jsonSchema as any).properties.version;
      expect(version.bsonType).toEqual(['int', 'long', 'double']);
      expect(version.minimum).toBe(1);
    }
  });

  it('applies the same forward-only collMod contract on repeated calls', async () => {
    const command = jest.fn().mockResolvedValue({ ok: 1 });
    const db = { command } as never;
    await applyCareCatalogNumericVersionValidator(db);
    await applyCareCatalogNumericVersionValidator(db);
    expect(command).toHaveBeenCalledTimes(4);
    expect(command.mock.calls.map(([input]) => input.collMod)).toEqual([
      'careprograms',
      'carerules',
      'careprograms',
      'carerules',
    ]);
  });
});
