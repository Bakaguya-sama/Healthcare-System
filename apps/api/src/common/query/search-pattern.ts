export const SEARCH_TERM_MIN_LENGTH = 2;
export const SEARCH_TERM_MAX_LENGTH = 100;

export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toLiteralCaseInsensitiveRegex(value: string): RegExp {
  return new RegExp(escapeRegexLiteral(value.trim()), 'i');
}
