export const BASELINE_SCHEMA_VERSION_V1 = 'v1';

export const BASELINE_FIELD_TYPES = [
  'number',
  'integer',
  'boolean',
  'string',
  'date',
] as const;
export type BaselineFieldType = (typeof BASELINE_FIELD_TYPES)[number];
export const BASELINE_VISIBILITIES = ['patient', 'care_team'] as const;
export type BaselineVisibility = (typeof BASELINE_VISIBILITIES)[number];

export type BaselineFieldV1 = {
  key: string;
  type: BaselineFieldType;
  unit?: string;
  range?: { min?: number; max?: number };
  required: boolean;
  visibility: BaselineVisibility;
};

export type BaselineFormV1 = {
  schemaVersion: typeof BASELINE_SCHEMA_VERSION_V1;
  fields: BaselineFieldV1[];
};

export type BaselineValidationIssue = {
  code:
    | 'schema_version_invalid'
    | 'schema_field_invalid'
    | 'answer_unknown_field'
    | 'answer_required'
    | 'answer_type_invalid'
    | 'answer_range_invalid';
  field?: string;
};

export type BaselineValidationResult =
  | { valid: true; form: BaselineFormV1 }
  | { valid: false; issues: BaselineValidationIssue[] };

const FIELD_KEYS = new Set([
  'key',
  'type',
  'unit',
  'range',
  'required',
  'visibility',
]);
const FORM_KEYS = new Set(['schemaVersion', 'fields']);
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fieldIsValid(field: unknown): field is BaselineFieldV1 {
  if (
    !plainObject(field) ||
    Object.keys(field).some((key) => !FIELD_KEYS.has(key))
  )
    return false;
  if (
    typeof field.key !== 'string' ||
    !KEY_PATTERN.test(field.key) ||
    !BASELINE_FIELD_TYPES.includes(field.type as BaselineFieldType) ||
    typeof field.required !== 'boolean' ||
    !BASELINE_VISIBILITIES.includes(field.visibility as BaselineVisibility)
  )
    return false;
  if (
    field.unit !== undefined &&
    (typeof field.unit !== 'string' || field.unit.length > 32)
  )
    return false;
  if (field.range !== undefined) {
    if (!plainObject(field.range)) return false;
    const range = field.range;
    const keys = Object.keys(range);
    if (!keys.length || keys.some((key) => key !== 'min' && key !== 'max'))
      return false;
    const { min, max } = range;
    if (
      (min !== undefined &&
        (typeof min !== 'number' || !Number.isFinite(min))) ||
      (max !== undefined &&
        (typeof max !== 'number' || !Number.isFinite(max))) ||
      (min !== undefined && max !== undefined && min > max) ||
      !['number', 'integer'].includes(field.type as string)
    )
      return false;
  }
  return true;
}

export function validateBaselineForm(value: unknown): BaselineValidationResult {
  if (
    !plainObject(value) ||
    Object.keys(value).some((key) => !FORM_KEYS.has(key)) ||
    value.schemaVersion !== BASELINE_SCHEMA_VERSION_V1 ||
    !Array.isArray(value.fields)
  )
    return { valid: false, issues: [{ code: 'schema_version_invalid' }] };
  const fields = value.fields;
  const invalid = fields.find((field) => !fieldIsValid(field));
  if (invalid)
    return { valid: false, issues: [{ code: 'schema_field_invalid' }] };
  const keys = fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length)
    return { valid: false, issues: [{ code: 'schema_field_invalid' }] };
  return { valid: true, form: value as BaselineFormV1 };
}

function isAnswerOfType(value: unknown, type: BaselineFieldType): boolean {
  if (type === 'number')
    return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer')
    return typeof value === 'number' && Number.isInteger(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string') return typeof value === 'string';
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateBaselineAnswers(
  formValue: unknown,
  answers: unknown,
): BaselineValidationResult {
  const form = validateBaselineForm(formValue);
  if (!form.valid) return form;
  if (!plainObject(answers))
    return { valid: false, issues: [{ code: 'answer_type_invalid' }] };
  const fields = new Map(form.form.fields.map((field) => [field.key, field]));
  const issues: BaselineValidationIssue[] = [];
  for (const key of Object.keys(answers))
    if (!fields.has(key))
      issues.push({ code: 'answer_unknown_field', field: key });
  for (const field of form.form.fields) {
    const answer = answers[field.key];
    if (
      answer === undefined ||
      answer === null ||
      (field.required && answer === '')
    ) {
      if (field.required)
        issues.push({ code: 'answer_required', field: field.key });
      continue;
    }
    if (!isAnswerOfType(answer, field.type)) {
      issues.push({ code: 'answer_type_invalid', field: field.key });
      continue;
    }
    if (field.range && typeof answer === 'number') {
      if (
        (field.range.min !== undefined && answer < field.range.min) ||
        (field.range.max !== undefined && answer > field.range.max)
      )
        issues.push({ code: 'answer_range_invalid', field: field.key });
    }
  }
  return issues.length ? { valid: false, issues } : form;
}

/** Returns only answers the requested audience is allowed to see. */
export function projectBaselineAnswers(
  formValue: unknown,
  answers: Record<string, unknown> | undefined,
  audience: BaselineVisibility,
): Record<string, unknown> | undefined {
  if (!answers) return undefined;
  const form = validateBaselineForm(formValue);
  if (!form.valid) return undefined;
  return Object.fromEntries(
    form.form.fields
      .filter(
        (field) => field.visibility === 'patient' || audience === 'care_team',
      )
      .filter((field) => answers[field.key] !== undefined)
      .map((field) => [field.key, answers[field.key]]),
  );
}
