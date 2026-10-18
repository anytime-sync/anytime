import { expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { loadTaskUpdateActivity } from './task-update-activity';

it('counts extant task rows in bounded rolling windows, including multiple tasks by one user', async () => {
  const now = new Date('2026-10-18T03:00:00Z');
  const rows = [
    ...Array.from({ length: 4 }, () => ({ user_id: 'same-person', updated_at: '2026-10-18T02:00:00Z' })),
    { user_id: 'another-person', updated_at: '2026-10-16T03:00:00Z' },
    { user_id: 'future', updated_at: '2026-10-19T03:00:00Z' },
  ];
  const requests: URL[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); requests.push(url);
    expect(url.origin).toBe('https://fixture.invalid');
    expect(url.pathname).toBe('/rest/v1/tasks');
    expect(init?.method).toBe('HEAD');
    expect(url.searchParams.get('select')).toBe('id');
    const filters = url.searchParams.getAll('updated_at');
    const start = filters.find(x => x.startsWith('gte.'))!.slice(4);
    const end = filters.find(x => x.startsWith('lte.'))!.slice(4);
    const count = rows.filter(row => new Date(row.updated_at) >= new Date(start) && new Date(row.updated_at) <= new Date(end)).length;
    return new Response(null, { headers: { 'content-range': `*/${count}` } });
  });
  const client = createClient('https://fixture.invalid', 'fixture-key', {global: {fetch: fetcher}});
  expect(await loadTaskUpdateActivity(client, now)).toEqual([
    {days: 1, count: 4}, {days: 3, count: 5}, {days: 7, count: 5}, {days: 14, count: 5}, {days: 30, count: 5},
  ]);
  expect(requests).toHaveLength(5);
  expect(requests.every(url => url.searchParams.getAll('updated_at').includes('lte.2026-10-18T03:00:00.000Z'))).toBe(true);
});

it('distinguishes empty activity from denied or unavailable measurements', async () => {
  for (const [response, expected] of [
    [new Response(null, {headers: {'content-range': '*/0'}}), 0],
    [new Response(null, {status: 403}), null],
    [new Response(null, {status: 200}), null],
  ] as const) {
    const client = createClient('https://fixture.invalid', 'fixture-key', {global: {fetch: async () => response.clone()}});
    expect((await loadTaskUpdateActivity(client)).every(row => row.count === expected)).toBe(true);
  }
});
