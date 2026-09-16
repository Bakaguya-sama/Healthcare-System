import {
  escapeRegexLiteral,
  toLiteralCaseInsensitiveRegex,
} from './search-pattern';

describe('search pattern helpers', () => {
  it('escapes regex metacharacters supplied by clients', () => {
    expect(escapeRegexLiteral('health.*(urgent)?')).toBe(
      'health\\.\\*\\(urgent\\)\\?',
    );
  });

  it('trims input and performs literal case-insensitive matching', () => {
    const pattern = toLiteralCaseInsensitiveRegex('  C++  ');

    expect(pattern.test('Learning c++ safely')).toBe(true);
    expect(pattern.test('Learning CCC safely')).toBe(false);
  });
});
