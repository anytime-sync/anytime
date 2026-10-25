import { describe, expect, it, vi } from 'vitest';
import { FEATURES, RETIRED_FEATURE_IDS } from '@/lib/plans';
import { canUseFeature } from '@/lib/feature-flags';
import { getAnthropic } from '@/lib/anthropic';
import { embedBatch } from '@/lib/voyage';
import { syncEmbedding } from '@/lib/embeddings';
import { POST } from '@/app/api/ai/plan-day/route';
import { t, LANGUAGES, setI18nOverrides } from '@/lib/i18n';

describe('retired hosted AI', () => {
  it('denies every plan before consulting live overrides', async () => {
    for (const id of RETIRED_FEATURE_IDS) {
      expect(FEATURES.some(f => f.id === id)).toBe(false);
      for (const plan of ['free', 'plus', 'pro', 'vip', 'team'] as const) {
        expect(await canUseFeature(plan, id)).toBe(false);
      }
    }
    expect(FEATURES.some(f => f.id === 'tasks_today')).toBe(true);
    expect(FEATURES.some(f => f.id === 'cal_gcal_write')).toBe(true);
    expect(FEATURES.some(f => f.id === 'plat_api_access')).toBe(true);
  });
  it('never calls paid providers even if a credential is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-not-a-real-key');
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    try {
      expect(getAnthropic()).toBeNull();
      await expect(embedBatch(['test'])).rejects.toThrow('feature_retired');
      const db = { from: vi.fn() };
      expect(await syncEmbedding({supabase: db as never, userId: 'test', sourceType: 'task', sourceId: 'test', content: 'test'})).toEqual({skipped: true});
      expect(db.from).not.toHaveBeenCalled();
      const response = await POST(new Request('https://firstlight.to/api/ai/plan-day', { method: 'POST' }));
      expect(response.status).toBe(410);
      expect(network).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  it('does not restore old landing offers from CMS overrides', () => {
    for (const lang of LANGUAGES) {
      setI18nOverrides(lang.code, {'landing.heroBody': 'Optional AI briefings'});
      expect(t(lang.code, 'landing.heroBody')).not.toContain('AI briefings');
      setI18nOverrides(lang.code, {});
    }
  });
});
