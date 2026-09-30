import type { Db, Document } from 'mongodb';
import { CC014_BASELINE_SCHEMA_COLLECTIONS } from './202609291300-cc014-baseline-schema-engine';
import { migrationChecksum } from './migration.types';

export const CC014_REMOVE_REDUNDANT_BASELINE_VERSION = 202609300900;
export const CC014_REMOVE_REDUNDANT_BASELINE_VERSION_NAME =
  'cc014-remove-redundant-baseline-version';
export const CC014_REMOVE_REDUNDANT_BASELINE_VERSION_CHECKSUM =
  migrationChecksum({
    version: CC014_REMOVE_REDUNDANT_BASELINE_VERSION,
    name: CC014_REMOVE_REDUNDANT_BASELINE_VERSION_NAME,
    steps: [
      'remove-patient-care-program-baseline-schema-version',
      'preserve-program-config-baseline-schema-version',
    ],
  });

function patientCareProgramValidator(): Document {
  const source = CC014_BASELINE_SCHEMA_COLLECTIONS.find(
    (collection) => collection.name === 'patientcareprograms',
  );
  if (!source) throw new Error('missing CC-014 patient enrollment contract');
  const validator = JSON.parse(JSON.stringify(source.validator)) as Document;
  const schema = validator.$jsonSchema as {
    required: string[];
    properties: Record<string, unknown>;
  };
  schema.required = schema.required.filter(
    (field) => field !== 'baselineSchemaVersion',
  );
  delete schema.properties.baselineSchemaVersion;
  return validator;
}

export const CC014_PATIENT_CARE_PROGRAM_VALIDATOR =
  patientCareProgramValidator();

export async function applyCc014RemoveRedundantBaselineVersion(
  db: Db,
): Promise<void> {
  await db
    .collection('patientcareprograms')
    .updateMany({}, { $unset: { baselineSchemaVersion: '' } });
  await db.command({
    collMod: 'patientcareprograms',
    validator: CC014_PATIENT_CARE_PROGRAM_VALIDATOR,
    validationLevel: 'strict',
    validationAction: 'error',
  });
}
