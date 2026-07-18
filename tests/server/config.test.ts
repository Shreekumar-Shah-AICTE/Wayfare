import { describe, expect, it } from 'vitest';

import { isRtlLocale } from '@/server/config';

describe('isRtlLocale', () => {
  it('identifies right-to-left locales', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('he')).toBe(true);
  });

  it('treats other locales as left-to-right', () => {
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('es')).toBe(false);
  });
});
