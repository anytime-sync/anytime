import { expect, it } from 'vitest';
import { calendarTask, resolveTaskDates, snoozedDue } from './task-schedule';
const task = { start_at: '2026-09-07T08:30:00Z', due_at: '2026-09-07T09:00:00Z', is_all_day: false };
it('moves both ends when an overdue block gets a new due date', () => {
  expect(resolveTaskDates(task, { due_at: '2026-09-14T09:00:00Z' })).toEqual({ start_at: '2026-09-14T08:30:00.000Z', due_at: '2026-09-14T09:00:00Z' });
});
it('does not stretch the block after repeated overdue moves', () => {
  let current: { start_at: string | null; due_at: string; is_all_day: boolean } = task;
  for (const day of ['14','21','28']) current = { ...current, ...resolveTaskDates(current, { due_at: `2026-09-${day}T09:00:00Z` }) };
  expect(Date.parse(current.due_at) - Date.parse(current.start_at!)).toBe(1800000);
});
it('renders a stale multi-week interval once at its deadline without changing storage', () => {
  const stale = { ...task, due_at: '2026-10-01T09:00:00Z' };
  expect(calendarTask(stale).start_at).toBeNull();
  expect(stale.start_at).toBe(task.start_at);
  expect(resolveTaskDates(stale, { due_at: '2026-10-02T09:00:00Z' }).start_at).toBeNull();
});
it('preserves explicit windows and nulls; rejects inversion without changing the deadline', () => {
  expect(resolveTaskDates(task, { start_at: null })).toEqual({ start_at: null });
  expect(() => resolveTaskDates(task, { start_at: '2026-10-01T10:00:00Z', due_at: task.due_at })).toThrow();
  expect(resolveTaskDates(task, { due_at: null })).toEqual({ due_at: null });
  expect(() => resolveTaskDates(task, { due_at: 'not a date' })).toThrow();
});
it('keeps all-day deadlines on one day', () => {
  expect(calendarTask({ ...task, is_all_day: true }).start_at).toBeNull();
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
