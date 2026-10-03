import { expect, it } from 'vitest';
import { buildIcs, type TaskRow } from './icalendar';
const task: TaskRow = { id: 'task', title: 'Review', notes: null, start_at: '2026-10-03T00:00:00Z', due_at: '2026-10-03T00:00:00Z', is_all_day: true, is_completed: false, rrule: null, updated_at: '2026-10-03T00:00:00Z', created_at: '2026-10-03T00:00:00Z', estimated_minutes: null };
it('single-day all-day events have an exclusive next-day end', () => {
  expect(buildIcs([task])).toContain('DTSTART;VALUE=DATE:20261003\r\nDTEND;VALUE=DATE:20261004');
  expect(buildIcs([{ ...task, start_at: null, due_at: '2026-10-31T00:00:00Z' }])).toContain('DTEND;VALUE=DATE:20261101');
});
it('retains an explicit multi-day exclusive end', () => {
  expect(buildIcs([{ ...task, due_at: '2026-10-06T00:00:00Z' }])).toContain('DTEND;VALUE=DATE:20261006');
});
it('excludes archived items but retains completed history', () => {
  expect(buildIcs([{ ...task, status: 'archived' }])).not.toContain('BEGIN:VEVENT');
  expect(buildIcs([{ ...task, status: 'done', is_completed: true }])).toContain('X-FL-COMPLETED:1');
});
it('folds Chinese and emoji on UTF-8 boundaries with at most 75 bytes per physical line', () => {
  const title = '台灣月度業績💡'.repeat(20);
  const ics = buildIcs([{ ...task, title }]);
  for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
  expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${title}\r\n`);
});

it('does not export a stale month-long task window as an occupied month', () => {
  const ics = buildIcs([{ ...task, is_all_day: false, start_at: '2026-09-02T00:00:00Z', due_at: '2026-10-01T09:00:00Z', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' }]);
  expect(ics).toContain('DTSTART:20261001T090000Z');
  expect(ics).toContain('DTEND:20261001T093000Z');
  expect(ics).not.toContain('DTSTART:20260902');
});
it('completed recurring history does not generate future recurring bookings', () => {
  const ics = buildIcs([{ ...task, is_completed: true, rrule: 'FREQ=DAILY', is_all_day: false, start_at: '2026-08-02T02:30:00Z', due_at: '2026-08-09T03:00:00Z' }]);
  expect(ics).not.toContain('RRULE:');
  expect(ics).toContain('DTSTART:20260809T030000Z');
});
