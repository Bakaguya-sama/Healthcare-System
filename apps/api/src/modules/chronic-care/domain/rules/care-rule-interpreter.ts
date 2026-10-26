export type CareEvaluationSeverity = 'normal' | 'attention' | 'urgent';

export type CareRuleNode = {
  operator: 'all' | 'any' | 'not' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'exists' | 'equal' | 'not_equal';
  key?: string;
  value?: number | string | boolean;
  min?: number;
  max?: number;
  rules?: CareRuleNode[];
  reasonCode?: string;
  severity?: Exclude<CareEvaluationSeverity, 'normal'>;
};

export type CareRuleEvaluation = {
  severity: CareEvaluationSeverity;
  reasonCodes: string[];
  inputKeys: string[];
};

const severityRank: Record<CareEvaluationSeverity, number> = {
  normal: 0,
  attention: 1,
  urgent: 2,
};

export function isCareRuleNode(value: unknown): value is CareRuleNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  const operators = new Set([
    'all', 'any', 'not', 'gt', 'gte', 'lt', 'lte', 'between', 'exists',
    'equal', 'not_equal',
  ]);
  if (typeof node.operator !== 'string' || !operators.has(node.operator))
    return false;
  if (['all', 'any', 'not'].includes(node.operator))
    return Array.isArray(node.rules) && node.rules.every(isCareRuleNode);
  return typeof node.key === 'string' && node.key.length > 0;
}

function matches(node: CareRuleNode, facts: Record<string, unknown>): boolean {
  if (node.operator === 'all') return node.rules!.every((child) => matches(child, facts));
  if (node.operator === 'any') return node.rules!.some((child) => matches(child, facts));
  if (node.operator === 'not') return !node.rules!.some((child) => matches(child, facts));
  const actual = facts[node.key!];
  if (node.operator === 'exists') return actual !== undefined && actual !== null;
  if (actual === undefined || actual === null) return false;
  if (node.operator === 'equal') return actual === node.value;
  if (node.operator === 'not_equal') return actual !== node.value;
  if (typeof actual !== 'number') return false;
  if (node.operator === 'gt') return actual > Number(node.value);
  if (node.operator === 'gte') return actual >= Number(node.value);
  if (node.operator === 'lt') return actual < Number(node.value);
  if (node.operator === 'lte') return actual <= Number(node.value);
  return actual >= Number(node.min) && actual <= Number(node.max);
}

export function evaluateCareRules(
  rules: readonly CareRuleNode[],
  facts: Record<string, unknown>,
): CareRuleEvaluation {
  let severity: CareEvaluationSeverity = 'normal';
  const reasonCodes: string[] = [];
  const inputKeys = new Set<string>();
  for (const rule of rules) {
    if (!matches(rule, facts)) continue;
    if (rule.key) inputKeys.add(rule.key);
    const candidate = rule.severity ?? 'attention';
    if (severityRank[candidate] > severityRank[severity]) severity = candidate;
    if (rule.reasonCode) reasonCodes.push(rule.reasonCode);
  }
  return { severity, reasonCodes: [...new Set(reasonCodes)], inputKeys: [...inputKeys] };
}
