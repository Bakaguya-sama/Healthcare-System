import { CareTaskType } from '../entities/care-task.entity';
import { CareContentDisplayType } from '../entities/care-content.entity';

export const HEALTH_CHECK_IN_SCHEMA_VERSION = 'health-check-in.v1';
export const MAX_CHECK_IN_SYMPTOMS = 8;

export type EducationContentRef = {
  contentId: string;
  version: string;
  locale: string;
  displayType: CareContentDisplayType;
};

export type CareTaskTemplate = {
  key: string;
  type: CareTaskType;
  required?: boolean;
  schedule: { frequency: 'daily'; time: string; windowMinutes: number };
  completionRule?: Record<string, unknown>;
  reminderPolicy?: Record<string, unknown>;
  contentRef?: EducationContentRef;
};

const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function validContentRef(value: unknown): value is EducationContentRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return (
    Object.keys(ref).every((key) =>
      ['contentId', 'version', 'locale', 'displayType'].includes(key),
    ) &&
    typeof ref.contentId === 'string' &&
    KEY.test(ref.contentId) &&
    typeof ref.version === 'string' &&
    VERSION.test(ref.version) &&
    typeof ref.locale === 'string' &&
    LOCALE.test(ref.locale) &&
    Object.values(CareContentDisplayType).includes(
      ref.displayType as CareContentDisplayType,
    )
  );
}

export function checkInAllowedSymptoms(
  completionRule: Record<string, unknown> | undefined,
): string[] | null {
  if (
    completionRule?.responseMode !== 'health_check_in' ||
    completionRule.schemaVersion !== HEALTH_CHECK_IN_SCHEMA_VERSION ||
    !Array.isArray(completionRule.allowedSymptomCodes) ||
    completionRule.allowedSymptomCodes.length > 64 ||
    completionRule.allowedSymptomCodes.some(
      (code) => typeof code !== 'string' || !KEY.test(code),
    ) ||
    new Set(completionRule.allowedSymptomCodes).size !==
      completionRule.allowedSymptomCodes.length
  )
    return null;
  return completionRule.allowedSymptomCodes as string[];
}

export function validateCareTaskTemplates(
  value: unknown,
): CareTaskTemplate[] | null {
  if (!Array.isArray(value)) return null;
  const templates = value as CareTaskTemplate[];
  if (
    new Set(templates.map((template) => template?.key)).size !==
    templates.length
  )
    return null;
  if (
    templates.some((template) => {
      const invalidBase =
        !template ||
        !KEY.test(template.key) ||
        !Object.values(CareTaskType).includes(template.type) ||
        !template.schedule ||
        template.schedule.frequency !== 'daily' ||
        !TIME.test(template.schedule.time) ||
        !Number.isInteger(template.schedule.windowMinutes) ||
        template.schedule.windowMinutes < 1 ||
        template.schedule.windowMinutes > 1440;
      if (invalidBase) return true;
      if (template.type === CareTaskType.CHECK_IN)
        return checkInAllowedSymptoms(template.completionRule) === null;
      if (template.type === CareTaskType.EDUCATION)
        return (
          template.completionRule?.responseMode !== 'acknowledge' ||
          !validContentRef(template.contentRef)
        );
      return template.contentRef !== undefined;
    })
  )
    return null;
  return templates;
}
