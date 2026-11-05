import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  saved: 'Asia/Taipei' as string | null,
  exists: true,
  between: false,
  filters: [] as string[],
}));
vi.mock('@/hooks/use-ai', () => ({
  useUserPrefs: () => ({ data: { timezone: null }, isSuccess: true }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'fixture' } } }) },
    from: () => {
      let update: any,
        conditional = false;
      const q: any = {
        eq: () => q,
        or: (value: string) => {
          f.filters.push(value);
          conditional = value === 'timezone.is.null,timezone.eq.';
          return q;
        },
        select: async () => {
          if (f.exists && (!conditional || !f.saved)) f.saved = update.timezone;
          return { data: [], error: null };
        },
        update: (value: any) => {
          update = value;
          return q;
        },
        upsert: async (value: any, opts: any) => {
          if (f.between) {
            f.exists = true;
            f.saved = 'Asia/Kathmandu';
          }
          if (!f.exists || !opts?.ignoreDuplicates) {
            f.exists = true;
            f.saved = value.timezone;
          }
          return { error: null };
        },
      };
      return q;
    },
  }),
}));
import { useTimezoneSync } from './use-timezone-sync';
function Probe() {
  useTimezoneSync();
  return null;
}
async function mount() {
  let tree: any;
  await act(async () => {
    tree = create(<Probe />);
  });
  act(() => tree.unmount());
}
beforeEach(() => {
  f.saved = 'Asia/Taipei';
  f.exists = true;
  f.between = false;
  f.filters = [];
});
it('stale cached missing preference cannot overwrite a confirmed zone', async () => {
  await mount();
  expect(f.saved).toBe('Asia/Taipei');
  expect(f.filters).toEqual(['timezone.is.null,timezone.eq.']);
});
it('missing row initializes once and another stale device cannot overwrite it', async () => {
  f.saved = null;
  f.exists = false;
  await mount();
  expect(f.saved).toBeTruthy();
  f.saved = 'Pacific/Pago_Pago';
  await mount();
  expect(f.saved).toBe('Pacific/Pago_Pago');
});
it('cross-device insert between conditional update and insert wins over initialization', async () => {
  f.saved = null;
  f.exists = false;
  f.between = true;
  await mount();
  expect(f.saved).toBe('Asia/Kathmandu');
});
