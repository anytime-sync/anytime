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
