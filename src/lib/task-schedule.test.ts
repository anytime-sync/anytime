import { expect, it } from 'vitest';
import { calendarTask, resolveTaskDates, snoozedDue } from './task-schedule';
import { projectTaskCalendar } from './task-calendar';
const task = { start_at: '2026-09-07T08:30:00Z', due_at: '2026-09-07T09:00:00Z', is_all_day: false };
it('moves both ends when an overdue block gets a new due date', () => {
  expect(resolveTaskDates(task, { due_at: '2026-09-14T09:00:00Z' })).toEqual({ start_at: '2026-09-14T08:30:00.000Z', due_at: '2026-09-14T09:00:00Z' });
});
it('does not stretch the block after repeated overdue moves', () => {
  let current: { start_at: string | null; due_at: string; is_all_day: boolean } = task;
  for (const day of ['14','21','28']) current = { ...current, ...resolveTaskDates(current, { due_at: `2026-09-${day}T09:00:00Z` }) };
  expect(Date.parse(current.due_at) - Date.parse(current.start_at!)).toBe(1800000);
});
it('projects explicit deadline ranges without altering storage', () => {
  const stale = { ...task, time_kind: 'deadline' as const, due_at: '2026-10-01T09:00:00Z' };
  expect(calendarTask(stale).start_at).toBeNull();
  expect(stale.start_at).toBe(task.start_at);
  expect(resolveTaskDates(stale, { due_at: '2026-10-02T09:00:00Z' })).toEqual({ due_at: '2026-10-02T09:00:00Z' });
});
it('preserves explicit windows and nulls; rejects inversion without changing the deadline', () => {
  expect(resolveTaskDates(task, { start_at: null })).toEqual({ start_at: null, time_kind: 'deadline' });
  expect(() => resolveTaskDates(task, { start_at: '2026-10-01T10:00:00Z', due_at: task.due_at })).toThrow();
  expect(resolveTaskDates(task, { due_at: null })).toEqual({ due_at: null, time_kind: 'deadline' });
  expect(() => resolveTaskDates(task, { due_at: 'not a date' })).toThrow();
});
it('keeps all-day deadlines on one day', () => {
  expect(calendarTask({ ...task, time_kind: "deadline", is_all_day: true }).start_at).toBeNull();
});
it('snoozes old deadlines into the future, preserving local clock time', () => {
  const now = new Date(2026, 8, 12, 12);
  const due = new Date(2026, 6, 7, 9).toISOString();
  const next = snoozedDue(due, 1, now);
  expect(next.getDate()).toBe(13);
  expect(next.getMonth()).toBe(8);
  expect(next.getHours()).toBe(9);
  expect(+next).toBeGreaterThan(+now);
});

it.each([{ start_at: null, due_at: task.due_at }, { start_at: task.start_at, due_at: null }])('rejects incomplete merged work intent: %j', dates => {
  const current = { ...dates, time_kind: 'deadline' as const };
  expect(() => resolveTaskDates(current, { time_kind: 'work' })).toThrow('both dates');
  expect(() => resolveTaskDates({ ...current, time_kind: 'span' }, { time_kind: 'work', is_all_day: false })).toThrow('both dates');
  expect(() => resolveTaskDates({ ...task, time_kind: 'work' }, { due_at: null, time_kind: 'work' })).toThrow('both dates');
});

it.each(['start_at', 'due_at'] as const)('moves civil spans by day count across DST when editing %s', boundary => {
  const span = { start_at: '2026-10-31T04:00:00Z', due_at: '2026-11-02T05:00:00Z', time_kind: 'span' as const, is_all_day: true };
  const moved = { ...span, ...resolveTaskDates(span, boundary === 'due_at' ? { due_at: '2026-11-09T05:00:00Z' } : { start_at: '2026-11-07T05:00:00Z' }, 'America/New_York') };
  expect(projectTaskCalendar(moved, 'America/New_York')).toMatchObject({ start: { date: '2026-11-07' }, end: { date: '2026-11-10' } });
  expect(Date.parse(moved.start_at!)).toBe(Date.parse('2026-11-07T05:00:00Z'));
});

it('preserves civil-date strings when moving date-only spans', () => {
  expect(resolveTaskDates({ start_at: '2026-10-31', due_at: '2026-11-02', time_kind: 'span' }, { due_at: '2026-11-09' }, 'America/New_York')).toEqual({ start_at: '2026-11-07', due_at: '2026-11-09' });
});
