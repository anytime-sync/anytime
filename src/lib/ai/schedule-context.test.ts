import { expect, it } from 'vitest';
import { buildScheduleDays, fetchScheduleContext, scheduleDates, renderScheduleContext, type UserWorkPrefs } from './schedule-context';
const prefs: UserWorkPrefs = { workStart: '09:00', workEnd: '18:00', energyPeakStart: '09:00', energyPeakEnd: '12:00', defaultTaskMinutes: 30, dailyCapacityMinutes: 480 };
const now = new Date('2026-09-11T00:00:00Z');
it('keeps consecutive local days across daylight saving changes', () => {
  expect(scheduleDates(new Date('2026-11-01T03:30:00Z'), 'America/New_York', 3)).toEqual(['2026-10-31','2026-11-01','2026-11-02']);
});
it('uses the local weekday, even when UTC is yesterday', () => {
  const dates = scheduleDates(new Date('2026-09-11T18:00:00Z'), 'Asia/Taipei', 1);
  expect(buildScheduleDays(dates, 'Asia/Taipei', [], [], prefs, now)[0].dayOfWeek).toBe('Sat');
});
it('includes a meeting carried over from yesterday and clips midnight ends', () => {
  const days = buildScheduleDays(['2026-09-12'], 'UTC', [
    { start_at: '2026-09-11T23:00:00Z', end_at: '2026-09-12T10:00:00Z' },
    { start_at: '2026-09-12T17:00:00Z', end_at: '2026-09-13T00:00:00Z' },
  ], [], prefs, now);
  expect(days[0].freeMinutes).toBe(420);
  expect(days[0].busyBlocks.map(b => [b.start,b.end])).toEqual([['00:00','10:00'],['17:00','24:00']]);
});
it('merges overlapping meetings instead of subtracting twice', () => {
  const [day] = buildScheduleDays(['2026-09-12'], 'UTC', [
    { start_at: '2026-09-12T09:00:00Z', end_at: '2026-09-12T11:00:00Z' },
    { start_at: '2026-09-12T10:00:00Z', end_at: '2026-09-12T12:00:00Z' },
  ], [], prefs, now);
  expect(day.freeMinutes).toBe(360);
});
it('ignores stale task ranges and counts real task blocks', () => {
  const [day] = buildScheduleDays(['2026-09-12'], 'UTC', [], [
    { start_at: '2026-09-01T09:00:00Z', due_at: '2026-09-12T17:00:00Z' },
    { start_at: '2026-09-12T09:00:00Z', due_at: '2026-09-12T12:00:00Z' },
  ], prefs, now);
  expect(day.busyBlocks).toHaveLength(1);
  expect(day.freeMinutes).toBe(360);
});
it('does not offer elapsed hours as remaining capacity', () => {
  const [day] = buildScheduleDays(['2026-09-12'], 'UTC', [], [], prefs, new Date('2026-09-12T16:00:00Z'));
  expect(day.freeMinutes).toBe(120);
  expect(renderScheduleContext({ prefs, days: [day] })).toContain('next 1 days');
});
it('refuses to advertise free time when calendar data failed or was truncated', async () => {
  for (const result of [{ data: null, error: { message: 'unavailable' } }, { data: Array(201).fill({}), error: null }]) {
    const chain: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) };
    for (const method of ['select','eq','neq','not','gt','lt','order','limit','maybeSingle']) chain[method] = () => chain;
    const client: any = { from: () => chain };
    await expect(fetchScheduleContext(client, 'test-user', 'UTC')).rejects.toThrow();
  }
});
