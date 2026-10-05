import { describe, expect, it } from 'vitest';
import { buildIcs, type IcsTaskRow } from './ical-feed';

const base: IcsTaskRow = {
  id: 'task-1', title: 'Meeting', notes: null,
  start_at: '2026-10-04T01:00:00Z', due_at: '2026-10-04T01:30:00Z',
  is_all_day: false, is_completed: false, status: 'open', rrule: null,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-03T00:00:00Z', estimated_minutes: null,
};
const feed = (patch: Partial<IcsTaskRow> = {}, zone = 'Asia/Taipei') => buildIcs([{ ...base, ...patch }], zone);

describe('Apple Calendar feed regressions', () => {
  it('removes completed recurring jobs instead of repeating seven-day spans forever', () => {
    const ics = feed({ title: 'Completed daily job', start_at: '2026-08-02T02:30:00Z', due_at: '2026-08-09T03:00:00Z', is_completed: true, status: 'done', rrule: 'FREQ=DAILY' });
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).not.toContain('RRULE');
  });
  it.each([{ status: 'archived' }, { status: 'done' }, { is_completed: true }])('hides inactive tasks even when legacy flags disagree: %j', patch => {
    expect(feed(patch)).not.toContain('BEGIN:VEVENT');
  });
  it('represents an active stale interval at its deadline, keeping the same UID', () => {
    const ics = feed({ start_at: '2026-08-02T02:30:00Z', due_at: '2026-10-04T03:00:00Z', rrule: 'FREQ=DAILY' });
    expect(ics).toContain('DTSTART:20261004T030000Z\r\nDTEND:20261004T033000Z');
    expect(ics).toContain('UID:task-1@firstlight.to');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('TRANSP:TRANSPARENT');
  });
  it('preserves real same-day meeting times and weekly recurrence', () => {
    const ics = feed({ rrule: 'FREQ=WEEKLY;BYDAY=SU' });
    expect(ics).toContain('DTSTART:20261004T010000Z\r\nDTEND:20261004T013000Z');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU');
    expect(ics).toContain('TRANSP:OPAQUE');
  });
  it('preserves overnight meetings shorter than a day', () => {
    const ics = feed({ start_at: '2026-10-04T15:00:00Z', due_at: '2026-10-04T17:00:00Z' });
    expect(ics).toContain('DTEND:20261004T170000Z');
  });
  it('uses the Taipei date and exclusive next day for an all-day deadline', () => {
    const ics = feed({ is_all_day: true, start_at: null, due_at: '2026-10-03T16:00:00Z' });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261004\r\nDTEND;VALUE=DATE:20261005');
    expect(ics).toContain('X-WR-TIMEZONE:Asia/Taipei');
  });
  it('keeps a start-only all-day task, with a valid one-day duration', () => {
    expect(feed({ is_all_day: true, due_at: null })).toContain('DTSTART;VALUE=DATE:20261004\r\nDTEND;VALUE=DATE:20261005');
  });
  it('uses the deadline for stale all-day starts and preserves month-end recurrence', () => {
    const ics = feed({ is_all_day: true, start_at: '2026-10-07T00:00:00Z', due_at: '2026-10-08T00:30:00Z', rrule: 'FREQ=MONTHLY;BYMONTHDAY=8' });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261008\r\nDTEND;VALUE=DATE:20261009');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=8');
  });
  it('normalizes all-day UNTIL to DATE and removes time selectors', () => {
    const ics = feed({ is_all_day: true, rrule: 'FREQ=DAILY;UNTIL=20261030T160000Z;BYHOUR=9' });
    expect(ics).toContain('RRULE:FREQ=DAILY;UNTIL=20261031\r\n');
  });
  it('folds Chinese and emoji in UTF-8 octets without corrupting text', () => {
    const title = '陪課與業務會議📆'.repeat(20);
    const ics = feed({ title });
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${title}\r\n`);
    expect(Buffer.from(ics).toString()).toBe(ics);
  });
  it('rejects invalid and injected recurrence without losing the appointment', () => {
    for (const rrule of ['garbage', 'FREQ=DAILY\r\nEND:VEVENT\r\nBEGIN:VEVENT']) {
      const ics = feed({ rrule });
      expect(ics).not.toContain('RRULE:');
      expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    }
  });
  it('falls back for invalid timezones, skips invalid dates and escapes notes', () => {
    expect(feed({}, 'Invalid/Timezone')).toContain('X-WR-TIMEZONE:UTC');
    expect(feed({ start_at: 'invalid', due_at: null })).not.toContain('BEGIN:VEVENT');
    expect(feed({ notes: 'a,b;c\nEND:VEVENT' })).toContain('DESCRIPTION:a\\,b\\;c\\nEND:VEVENT');
  });
});
