import type { CareRuleNode } from './care-rule-interpreter';
import {
  HEALTH_CHECK_IN_SCHEMA_VERSION,
  type CareTaskTemplate,
} from '../tasks/care-task-template.validator';
import { CareTaskType } from '../entities/care-task.entity';

const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const CHECK_IN_FACTS = new Set([
  'check_in.overall_status',
  'check_in.severity',
  'check_in.severity_rank',
  'check_in.symptom.',
]);

type CheckInDataSource = {
  kind: 'care_task_check_in';
  schemaVersion: typeof HEALTH_CHECK_IN_SCHEMA_VERSION;
  templateKey: string;
  allowedFactPrefixes: string[];
};

function leafKeys(nodes: readonly CareRuleNode[]): string[] {
  return nodes.flatMap((node) =>
    node.rules ? leafKeys(node.rules) : node.key ? [node.key] : [],
  );
}

function checkInSources(value: unknown): CheckInDataSource[] | null {
  if (!Array.isArray(value)) return null;
  const sources = value.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item as Record<string, unknown>).kind === 'care_task_check_in',
  ) as CheckInDataSource[];
  for (const source of sources) {
    if (
      source.schemaVersion !== HEALTH_CHECK_IN_SCHEMA_VERSION ||
      !KEY.test(source.templateKey) ||
      !Array.isArray(source.allowedFactPrefixes) ||
      source.allowedFactPrefixes.length === 0 ||
      source.allowedFactPrefixes.some(
        (prefix) => typeof prefix !== 'string' || !CHECK_IN_FACTS.has(prefix),
      ) ||
      new Set(source.allowedFactPrefixes).size !==
        source.allowedFactPrefixes.length
    )
      return null;
  }
  return sources;
}

export function validateCareRuleDataSources(
  rules: readonly CareRuleNode[],
  dataSources: unknown,
  templates: readonly CareTaskTemplate[],
): boolean {
  const keys = leafKeys(rules).filter((key) => key.startsWith('check_in.'));
  const sources = checkInSources(dataSources);
  if (!sources) return false;
  if (keys.length === 0) return true;
  if (sources.length === 0) return false;

  return sources.some((source) => {
    const templateExists = templates.some(
      (template) =>
        template.type === CareTaskType.CHECK_IN &&
        template.key === source.templateKey,
    );
    if (!templateExists) return false;
    return keys.every((key) =>
      source.allowedFactPrefixes.some((prefix) =>
        prefix.endsWith('.') ? key.startsWith(prefix) : key === prefix,
      ),
    );
  });
}
