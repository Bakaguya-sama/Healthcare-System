import { CareTaskType } from '../entities/care-task.entity';

export type CareTaskTemplate = {
  key: string;
  type: CareTaskType;
  required?: boolean;
  schedule: { frequency: 'daily'; time: string; windowMinutes: number };
  completionRule?: Record<string, unknown>;
  reminderPolicy?: Record<string, unknown>;
};

const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    templates.some(
      (template) =>
        !template ||
        !KEY.test(template.key) ||
        !Object.values(CareTaskType).includes(template.type) ||
        !template.schedule ||
        template.schedule.frequency !== 'daily' ||
        !TIME.test(template.schedule.time) ||
        !Number.isInteger(template.schedule.windowMinutes) ||
        template.schedule.windowMinutes < 1 ||
        template.schedule.windowMinutes > 1440,
    )
  )
    return null;
  return templates;
}
