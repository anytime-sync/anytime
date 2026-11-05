import { expect, it } from 'vitest';
import { calendarDate, dayWindow } from './day-window';
import { taskViewWindow } from './task-view-window';

it.each([
  ['Asia/Taipei', '2026-10-25T18:00:00Z', '2026-10-25T16:00:00.000Z', '2026-10-26T16:00:00.000Z'],
  ['America/Los_Angeles', '2026-10-26T01:00:00Z', '2026-10-25T07:00:00.000Z', '2026-10-26T07:00:00.000Z'],
  ['Asia/Kathmandu', '2026-10-25T20:00:00Z', '2026-10-25T18:15:00.000Z', '2026-10-26T18:15:00.000Z'],
])('%s uses the existing digest dayWindow contract', (zone, now, start, end) => {
  const date = calendarDate(new Date(now), zone);
  const win = taskViewWindow('today', date, zone)!;
  expect(win.from.toISOString()).toBe(start); expect(win.to.toISOString()).toBe(end);
  expect(win).toEqual({ from: dayWindow(date, zone).start, to: dayWindow(date, zone).nextStart });
});
it.each([['2026-03-08', 23], ['2026-11-01', 25]] as const)('preserves the %s New York DST day', (date, hours) => {
  const win = taskViewWindow('today', date, 'America/New_York')!;
  expect(+win.to - +win.from).toBe(hours * 3600000);
  expect(taskViewWindow('tomorrow', date, 'America/New_York')!.from).toEqual(win.to);
});
it('counts civil days across DST and the year boundary', () => {
  expect(taskViewWindow('next7', '2026-03-06', 'America/New_York')!.to.toISOString()).toBe('2026-03-13T04:00:00.000Z');
  expect(taskViewWindow('next90', '2026-12-31', 'Asia/Taipei')!.to.toISOString()).toBe('2027-03-30T16:00:00.000Z');
});
it.each(['all', 'inbox', 'completed', undefined])('keeps %s unbounded', view => {
  expect(taskViewWindow(view, '2026-11-03', 'Asia/Taipei')).toBeNull();
});
