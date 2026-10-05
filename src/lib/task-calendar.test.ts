import { describe, expect, it } from 'vitest';
import { projectTaskCalendar, normalizeTaskDate } from './task-calendar';
import { createTaskDates, resolveTaskDates, taskTimeKind } from './task-schedule';
import { nextTaskRecurrence } from './task-recurrence';
const work = { start_at: '2026-10-07T22:00:04.123Z', due_at: '2026-10-09T08:00:06.456Z', time_kind: 'work' as const, is_all_day: false };

describe('explicit time intent', () => {
  it('does not invent starts or ends on creation', () => {
    expect(createTaskDates({ due_at: work.due_at })).toEqual({ due_at: work.due_at, time_kind: 'deadline' });
    expect(createTaskDates({ start_at: work.start_at })).toEqual({ start_at: work.start_at, time_kind: 'deadline' });
    expect(() => createTaskDates({ ...work, due_at: null })).toThrow();
  });
  it('preserves long legacy and intentional work without a duration cutoff', () => {
    for (const time_kind of [null, 'work'] as const) {
      const task = { ...work, time_kind };
      expect(taskTimeKind(task)).toBe('work');
      expect(projectTaskCalendar(task)?.end).toEqual({ dateTime: work.due_at });
      const patch = resolveTaskDates(task, { start_at: '2026-10-10T04:00:00.000Z' });
      expect(Date.parse(patch.due_at!) - Date.parse(patch.start_at!)).toBe(Date.parse(work.due_at) - Date.parse(work.start_at));
    }
  });
  it('keeps explicit lifecycle ranges at the deadline, transparent and date-only', () => {
    const projected = projectTaskCalendar({ ...work, time_kind: 'deadline' }, 'Asia/Taipei');
    expect(projected).toMatchObject({ start: { date: '2026-10-09' }, end: { date: '2026-10-10' }, transparency: 'transparent', deadline: work.due_at });
  });
  it('preserves short slots including seconds when rescheduling', () => {
    const task = { ...work, due_at: '2026-10-07T22:03:06.456Z' };
    const patch = resolveTaskDates(task, { due_at: '2026-10-08T10:00:00Z' });
    expect(Date.parse(patch.due_at!) - Date.parse(patch.start_at!)).toBe(182333);
  });
  it('respects explicit boundary edits and clearing', () => {
    expect(resolveTaskDates(work, { start_at: work.start_at, due_at: '2026-10-07T23:00:00Z' }).due_at).toBe('2026-10-07T23:00:00Z');
    expect(resolveTaskDates(work, { start_at: null })).toEqual({ start_at: null, time_kind: 'deadline' });
    expect(() => createTaskDates({ start_at: work.due_at, due_at: work.start_at })).toThrow();
  });
  it('exports inclusive spans with exclusive all-day ends across years', () => {
    const projection = projectTaskCalendar({ start_at: '2026-12-30T16:00:00Z', due_at: '2027-01-02T16:00:00Z', time_kind: 'span' }, 'Asia/Taipei');
    expect(projection).toMatchObject({ start: { date: '2026-12-31' }, end: { date: '2027-01-04' } });
  });
  it.each(['Asia/Taipei', 'America/Los_Angeles', 'America/New_York'])('preserves date-only single endpoints in %s', zone => {
    expect(projectTaskCalendar({ due_at: '2026-10-08', time_kind: 'deadline' }, zone)).toMatchObject({ start: { date: '2026-10-08' }, end: { date: '2026-10-09' } });
    expect(projectTaskCalendar({ start_at: '2026-10-08', is_all_day: true }, zone)?.start).toEqual({ date: '2026-10-08' });
  });
  it('normalizes date-only input to Taipei midnight before timestamptz storage', () => {
    expect(normalizeTaskDate('2026-10-08', 'Asia/Taipei')).toBe('2026-10-07T16:00:00.000Z');
  });
  it('uses calendar days at DST boundaries', () => {
    expect(projectTaskCalendar({ due_at: '2026-11-01T04:00:00Z', time_kind: 'deadline' }, 'America/New_York')?.end).toEqual({ date: '2026-11-02' });
  });
  it('advances recurrence without inventing starts or restarting COUNT', () => {
    const first = { due_at: '2026-10-08T01:00:00Z', time_kind: 'deadline' as const, rrule: 'FREQ=DAILY;COUNT=2' };
    const next = nextTaskRecurrence(first)!;
    expect(next.patch).toEqual({ due_at: '2026-10-09T01:00:00.000Z', rrule: 'FREQ=DAILY;COUNT=1' });
    expect(nextTaskRecurrence({ ...first, ...next.patch })).toBeNull();
    const moved = nextTaskRecurrence({ ...work, rrule: 'FREQ=WEEKLY' })!.patch;
    expect(Date.parse(moved.due_at!) - Date.parse(moved.start_at!)).toBe(Date.parse(work.due_at) - Date.parse(work.start_at));
  });
  it('advances recurring 09:00 work by its local start across fall DST, preserving duration', () => {
    const task = { start_at: '2026-10-25T13:00:00Z', due_at: '2026-10-25T14:30:00Z', time_kind: 'work' as const, rrule: 'FREQ=WEEKLY;BYDAY=SU;COUNT=3' };
    const first = nextTaskRecurrence(task, 'America/New_York')!;
    expect(first.patch).toMatchObject({ start_at: '2026-11-01T14:00:00.000Z', due_at: '2026-11-01T15:30:00.000Z', rrule: 'FREQ=WEEKLY;BYDAY=SU;COUNT=2' });
    const second = nextTaskRecurrence({ ...task, ...first.patch }, 'America/New_York')!;
    expect(second.patch).toMatchObject({ start_at: '2026-11-08T14:00:00.000Z', due_at: '2026-11-08T15:30:00.000Z' });
    expect(nextTaskRecurrence({ ...task, ...second.patch }, 'America/New_York')).toBeNull();
  });
  it('keeps recurrent spans at local midnight and the same civil-day length through DST', () => {
    const task = { start_at: '2026-10-31T04:00:00Z', due_at: '2026-11-02T05:00:00Z', time_kind: 'span' as const, rrule: 'FREQ=WEEKLY' };
    const patch = nextTaskRecurrence(task, 'America/New_York')!.patch;
    expect(patch).toMatchObject({ start_at: '2026-11-07T05:00:00.000Z', due_at: '2026-11-09T05:00:00.000Z' });
  });
  it('uses the start weekday for overnight work and the exact UTC UNTIL limit', () => {
    const task = { start_at: '2026-10-31T23:00:00Z', due_at: '2026-11-01T08:00:00Z', time_kind: 'work' as const, rrule: 'FREQ=WEEKLY;BYDAY=SA;UNTIL=20261108T000000Z' };
    const patch = nextTaskRecurrence(task, 'America/New_York')!.patch;
    expect(patch).toMatchObject({ start_at: '2026-11-08T00:00:00.000Z', due_at: '2026-11-08T09:00:00.000Z' });
    expect(nextTaskRecurrence({ ...task, ...patch }, 'America/New_York')).toBeNull();
  });
  it('skips a nonexistent spring-forward clock time without shifting the deadline an hour', () => {
    const task = { due_at: '2026-03-01T07:30:00Z', time_kind: 'deadline' as const, rrule: 'FREQ=WEEKLY;COUNT=2' };
    const next = nextTaskRecurrence(task, 'America/New_York')!;
    expect(next.patch.due_at).toBe('2026-03-15T06:30:00.000Z');
    expect(next.patch.rrule).toBe('FREQ=WEEKLY;COUNT=1');
  });
});
