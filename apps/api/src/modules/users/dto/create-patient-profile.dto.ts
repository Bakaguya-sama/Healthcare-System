/**
 * CreatePatientProfileDto
 * 
 * Patient profile is template-aligned with ONLY userId field.
 * Patient profile is created automatically when a user registers with 'patient' role.
 * No additional fields can be set during creation - userId is auto-set from auth context.
 * 
 * DB Template Spec (Patients table):
 * - user_id ObjectID [pk] // Only field (no other attributes)
 */
export class CreatePatientProfileDto {
  // Empty - Patient only has userId from auth, no additional fields needed per template
}
