import type { Db } from 'mongodb';
import { migrationChecksum } from './migration.types';
export const CC001B_ENROLLMENT_VERSION = 202609291100;
export const CC001B_ENROLLMENT_NAME = 'cc001b-enrollment';
export const CC001B_ENROLLMENT_CHECKSUM = migrationChecksum({ version: CC001B_ENROLLMENT_VERSION, name: CC001B_ENROLLMENT_NAME, steps: ['backfill-enrollment-revision', 'extend-care-idempotency-validator'] });
export async function applyCc001bEnrollment(db: Db): Promise<void> {
  await db.collection('patientcareprograms').updateMany({ revision: { $exists: false } }, { $set: { revision: 1 } });
  await db.command({ collMod: 'carecommandidempotencies', validator: { $jsonSchema: { bsonType: 'object', required: ['actorId','operation','key','requestHash','entityType','entityId','createdAt','updatedAt'], properties: { actorId:{bsonType:'objectId'}, operation:{bsonType:'string'}, key:{bsonType:'string'}, requestHash:{bsonType:'string'}, entityType:{enum:['careProgram','careRule','careEnrollment']}, entityId:{bsonType:'objectId'}, createdAt:{bsonType:'date'}, updatedAt:{bsonType:'date'} } } }, validationLevel: 'strict', validationAction: 'error' });
}
