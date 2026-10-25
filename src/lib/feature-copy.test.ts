import { describe, expect, it } from 'vitest';
import { FEATURES } from './plans';
import { FEATURE_COPY } from './feature-copy';

describe('current feature translations', () => {
  it('covers every offered feature in each non-English language', () => {
    for (const [locale, entries] of Object.entries(FEATURE_COPY)) {
      for (const feature of FEATURES) {
        expect(entries[feature.id], `${locale}/${feature.id}`).toHaveLength(2);
        expect(entries[feature.id].every(text => text.trim())).toBe(true);
      }
    }
  });
});
