import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseQuickInput } from './quick-parse';
import { projectTaskCalendar } from './task-calendar';
import { nextTaskRecurrence } from './task-recurrence';
import { patchCalendarEvent, deleteCalendarEvent } from './google-calendar';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-07T18:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('PR36 regression: future local time resolves in account IANA zone after DST', () => {
  const parsed = parseQuickInput('Review tomorrow at 9am', {
    timezone: 'America/New_York',
  } as any);
  expect(parsed.due_at).toBe('2026-03-08T13:00:00.000Z');
});
it('PR36 regression: date-only capture records a civil date independently of its compatibility instant', () => {
  const parsed = parseQuickInput('Review tomorrow', {
    timezone: 'Pacific/Kiritimati',
  } as any);
  expect(parsed).toMatchObject({ due_date: '2026-03-09', is_all_day: true });
});
it.each(['Pacific/Pago_Pago', 'America/Los_Angeles'])(
  'PR36 regression: saved date-only intent does not move in %s',
  (timezone) => {
    const projection = projectTaskCalendar(
      {
        due_at: '2026-03-08T10:00:00.000Z',
        due_date: '2026-03-09',
        schedule_timezone: 'Pacific/Kiritimati',
        time_kind: 'deadline',
        is_all_day: true,
      } as any,
      timezone,
    );
    expect(projection).toMatchObject({
      start: { date: '2026-03-09' },
      end: { date: '2026-03-10' },
    });
  },
);
it('PR36 regression: recurrence keeps its saved series zone when the account changes', () => {
  const next = nextTaskRecurrence(
    {
      due_at: '2026-03-07T14:00:00.000Z',
      time_kind: 'deadline',
      is_all_day: false,
      rrule: 'FREQ=DAILY;COUNT=2',
      schedule_timezone: 'America/New_York',
    } as any,
    'Asia/Taipei',
  );
  expect(next?.patch.due_at).toBe('2026-03-08T13:00:00.000Z');
});
it('PR36 regression: invalid recurrence is an error, not successful exhaustion', () => {
  expect(() =>
    nextTaskRecurrence(
      {
        due_at: '2026-03-07T14:00:00Z',
        time_kind: 'deadline',
        rrule: 'FREQ=INVALID',
      },
      'UTC',
    ),
  ).toThrow();
});
it('PR36 regression: relative reminder follows the actual next occurrence', () => {
  const next = nextTaskRecurrence(
    {
      due_at: '2026-03-07T14:00:00Z',
      time_kind: 'deadline',
      rrule: 'FREQ=DAILY',
      reminder_at: '2026-03-07T13:30:00Z',
      reminder_offset_min: 30,
    } as any,
    'America/New_York',
  );
  expect(next?.patch).toMatchObject({
    reminder_at: '2026-03-08T12:30:00.000Z',
  });
});
it.each(['patch', 'delete'])(
  'PR36 regression: Google %s sends the acknowledged If-Match ETag',
  async (method) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'fixture-event', etag: '"new"' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const args = {
      accessToken: 'fixture-token',
      calendarId: 'fixture-calendar',
      eventId: 'fixture-event',
      ifMatch: '"baseline"',
      sendUpdates: 'none' as const,
      patch: { summary: 'Fixture' },
    };
    if (method === 'patch') await patchCalendarEvent(args);
    else await deleteCalendarEvent(args);
    expect(new Headers(fetch.mock.calls[0][1].headers).get('If-Match')).toBe(
      '"baseline"',
    );
    expect(fetch.mock.calls[0][0]).toContain('sendUpdates=none');
  },
);
