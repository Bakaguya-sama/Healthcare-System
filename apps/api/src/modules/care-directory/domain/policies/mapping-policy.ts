import type { MappingScope } from '../care-directory.types';

export function validateMapping(
  scope: MappingScope,
  scopeKey: string,
  specialtyCodes: string[],
): void {
  if (!['program', 'disease'].includes(scope))
    throw new Error('MAPPING_SCOPE_INVALID');
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(scopeKey.trim()))
    throw new Error('MAPPING_KEY_INVALID');
  if (specialtyCodes.length === 0 || specialtyCodes.length > 20)
    throw new Error('MAPPING_SPECIALTIES_INVALID');
  const normalized = specialtyCodes.map((code) => code.trim().toLowerCase());
  if (
    normalized.some((code) => !/^[a-z0-9][a-z0-9._-]{1,59}$/.test(code)) ||
    new Set(normalized).size !== normalized.length
  )
    throw new Error('MAPPING_SPECIALTIES_INVALID');
}

export function chooseMapping<
  T extends { scope: MappingScope; scopeKey: string },
>(input: {
  programCode?: string;
  diseaseKey?: string;
  programMappings: T[];
  diseaseMappings: T[];
}): {
  mapping: T | null;
  source: 'program_mapping' | 'disease_mapping' | null;
} {
  if (input.programCode) {
    const match = input.programMappings.find(
      (item) => item.scope === 'program' && item.scopeKey === input.programCode,
    );
    if (match) return { mapping: match, source: 'program_mapping' };
  }
  if (input.diseaseKey) {
    const match = input.diseaseMappings.find(
      (item) => item.scope === 'disease' && item.scopeKey === input.diseaseKey,
    );
    if (match) return { mapping: match, source: 'disease_mapping' };
  }
  return { mapping: null, source: null };
}
