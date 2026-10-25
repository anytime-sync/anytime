import { describe, expect, it } from 'vitest';
import { authDestination } from './auth-destination';

describe('auth return paths', () => {
  it('preserves local destinations and their query strings', () => {
    expect(authDestination('/pricing?plan=plus')).toBe('/pricing?plan=plus');
    expect(authDestination('/app/today#task')).toBe('/app/today#task');
  });
  it.each([undefined, null, '', 'https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/\n/example.com'])('rejects unsafe destination %s', value => {
    expect(authDestination(value)).toBe('/app');
  });
});
