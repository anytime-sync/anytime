import { expect, it } from 'vitest';
import { format, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import {
  civilDay,
  civilKey,
  civilTime,
  civilWindow,
  taskDays,
  eventDays,
  shiftTaskDays,
} from './calendar-civil';
import {
  createTaskDates,
  resolveTaskDates,
  snoozeTaskDates,
} from './task-schedule';
import {
  dayWindow,
  resolveLocalInput,
  wallClockCandidates,
} from './day-window';
import { nextTaskRecurrence } from './task-recurrence';
import { googleEventDates, toCalendarEventRow } from './calendar-event-dates';
it.each([
  ['2026-03-08', 'America/New_York', 23],
  ['2026-11-01', 'America/New_York', 25],
  ['2026-10-04', 'Australia/Lord_Howe', 23.5],
  ['2026-04-05', 'Australia/Lord_Howe', 24.5],
])('half-open civil day %s %s contains %s hours', (date, zone, hours) => {
  const w = dayWindow(date as string, zone as string);
  expect((+w.nextStart - +w.start) / 3600000).toBe(hours);
  const d = civilDay(date as string, zone as string);
  expect(civilWindow(d, zone as string)).toEqual(w);
  expect(format(d, 'yyyy-MM-dd')).toBe(date);
});
it('Kathmandu fractional wall time is host independent', () => {
  expect(resolveLocalInput('2026-11-05T09:00', 'Asia/Kathmandu')).toBe(
    '2026-11-05T03:15:00.000Z',
  );
});
it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
  'civil dates retain their exact day while traveling in %s',
  (zone) => {
    const t = createTaskDates(
      { due_date: '2026-11-05', is_all_day: true, time_kind: 'deadline' },
      'Asia/Taipei',
    );
    expect(civilKey(taskDays(t, zone)!.first)).toBe('2026-11-05');
    const moved = resolveTaskDates(t, shiftTaskDays(t, 1, zone), zone);
    expect(moved.due_date).toBe('2026-11-06');
    expect(moved.schedule_timezone).toBe('Asia/Taipei');
  },
);
it('calendar arithmetic across DST does not assume 24 hours per account day', () => {
  const first = civilDay('2026-11-01', 'America/New_York');
  const days = eachDayOfInterval({
    start: startOfWeek(first, { weekStartsOn: 1 }),
    end: endOfWeek(first, { weekStartsOn: 1 }),
  });
  expect(days.map(civilKey)).toEqual([
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
  ]);
});
it('midnight instants and cross-midnight work have half-open membership', () => {
  const midnight = {
    time_kind: 'work' as const,
    start_at: '2026-11-04T16:00:00Z',
    due_at: '2026-11-05T16:00:00Z',
    is_all_day: false,
  };
  expect(taskDays(midnight, 'Asia/Taipei')).toEqual({
    first: civilDay('2026-11-05', 'UTC'),
    last: civilDay('2026-11-05', 'UTC'),
  });
  expect(
    civilKey(
      taskDays({ ...midnight, due_at: '2026-11-05T16:01:00Z' }, 'Asia/Taipei')!
        .last,
    ),
  ).toBe('2026-11-06');
});
it('dragging timed work across DST preserves account wall time and elapsed duration', () => {
  const t = {
    time_kind: 'work' as const,
    start_at: '2026-03-07T14:00:00Z',
    due_at: '2026-03-07T14:05:06.456Z',
  };
  expect(shiftTaskDays(t, 1, 'America/New_York')).toEqual({
    start_at: '2026-03-08T13:00:00.000Z',
    due_at: '2026-03-08T13:05:06.456Z',
  });
  expect(
    format(civilTime('2026-03-08T13:00:00Z', 'America/New_York'), 'h:mm a'),
  ).toBe('9:00 AM');
});
it.each([
  ['America/New_York', '2026-03-08T02:30'],
  ['America/New_York', '2026-11-01T01:30'],
  ['Australia/Lord_Howe', '2026-10-04T02:15'],
  ['Australia/Lord_Howe', '2026-04-05T01:45'],
])('new local input explicitly rejects gap/fold %s %s', (zone, value) => {
  expect(() => resolveLocalInput(value, zone)).toThrow();
});
it('recurrence fold policy chooses the earlier occurrence deterministically', () => {
  expect(
    wallClockCandidates(new Date('2026-11-01T01:30Z'), 'America/New_York').map(
      (d) => d.toISOString(),
    ),
  ).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
});
it('all-day absent-end and multi-day explicit-end round trips are byte-consistent', () => {
  for (const start_at of ['2026-11-05', '2026-11-04T16:00:00Z']) {
    const fields = googleEventDates(
      { start_at, is_all_day: true },
      'Asia/Taipei',
    );
    expect(fields).toEqual({
      start: { date: '2026-11-05' },
      end: { date: '2026-11-06' },
    });
    const row = toCalendarEventRow({
      userId: 'fixture',
      calendarId: 'fixture',
      ev: { id: 'event', ...fields },
      timezone: 'Asia/Taipei',
    });
    expect(eventDays(row as any, 'Pacific/Pago_Pago')).toEqual({
      first: civilDay('2026-11-05', 'UTC'),
      last: civilDay('2026-11-05', 'UTC'),
    });
  }
  expect(
    googleEventDates(
      { start_date: '2026-11-05', end_date: '2026-11-08', is_all_day: true },
      'Asia/Taipei',
    ).end,
  ).toEqual({ date: '2026-11-08' });
});
it('all-day snooze changes civil commitment instead of interpreting a legacy midnight as device time', () => {
  expect(
    snoozeTaskDates(
      { due_date: '2026-11-05', due_at: '2026-11-04T10:00Z', is_all_day: true },
      1,
      'Pacific/Pago_Pago',
      new Date('2026-11-05T12:00Z'),
    ),
  ).toEqual({ due_date: '2026-11-06' });
});

it('a nonexistent recurrence is skipped without consuming COUNT and the reminder follows the next real occurrence', () => {
  const task = {
    time_kind: 'deadline' as const,
    is_all_day: false,
    due_at: '2026-03-07T07:30:00Z',
    schedule_timezone: 'America/New_York',
    rrule: 'FREQ=DAILY;COUNT=2',
    reminder_offset_min: 30,
  };
  const next = nextTaskRecurrence(task, 'Asia/Taipei')!;
  expect(next.patch).toMatchObject({
    due_at: '2026-03-09T06:30:00.000Z',
    rrule: 'FREQ=DAILY;COUNT=1',
    reminder_at: '2026-03-09T06:00:00.000Z',
  });
  expect(
    nextTaskRecurrence({ ...task, ...next.patch }, 'Asia/Taipei'),
  ).toBeNull();
});
it('Lord Howe recurring wall time follows its half-hour transition while preserving elapsed work', () => {
  const next = nextTaskRecurrence(
    {
      time_kind: 'work',
      start_at: '2026-10-02T22:30:00Z',
      due_at: '2026-10-02T23:30:00Z',
      schedule_timezone: 'Australia/Lord_Howe',
      rrule: 'FREQ=DAILY;COUNT=2',
    },
    'UTC',
  );
  expect(next?.patch).toMatchObject({
    start_at: '2026-10-03T22:00:00.000Z',
    due_at: '2026-10-03T23:00:00.000Z',
  });
});
