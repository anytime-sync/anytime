import { describe, expect, it } from 'vitest';
import { dayWindow, validDate, dailyTaskFilter } from './day-window';
describe('local calendar boundaries', () => {
  it('uses Taipei midnight instead of UTC', () => {
    expect(dayWindow('2026-09-12', 'Asia/Taipei').start.toISOString()).toBe('2026-09-11T16:00:00.000Z');
  });
  it.each([['2026-03-08', 23], ['2026-11-01', 25]])('handles New York DST on %s', (date, hours) => {
    const { start, nextStart } = dayWindow(String(date), 'America/New_York');
    expect((+nextStart - +start) / 3600000).toBe(hours);
  });
  it('handles fractional offsets', () => {
    expect(dayWindow('2026-09-12', 'Asia/Kolkata').start.toISOString()).toBe('2026-09-11T18:30:00.000Z');
  });
  it('rejects dates normalized into a different month', () => {
    expect(validDate('2026-02-30')).toBe(false);
    expect(() => dayWindow('bad', 'UTC')).toThrow();
  });
  it('requires both scheduled bounds while retaining overdue deadlines', () => {
    expect(dailyTaskFilter('start', 'next')).toBe('due_at.lt.next,and(start_at.gte.start,start_at.lt.next)');
  });
});
