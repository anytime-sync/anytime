import { expect, it } from 'vitest';
import { buildEventInput, type TaskRowForPush } from './calendar-write';
const task: TaskRowForPush = { id: 'task', user_id: 'owner', title: 'Monthly project review', notes: null, start_at: '2026-09-02T00:00:00Z', due_at: '2026-10-01T09:00:00Z', is_all_day: false, calendar_event_id: null, updated_at: null };
it('converts stale task ranges to a single deadline slot for Google as well as ICS', () => {
  expect(buildEventInput(task).start).toEqual({ dateTime: '2026-10-01T09:00:00Z' });
  expect(buildEventInput(task).end).toEqual({ dateTime: '2026-10-01T09:30:00.000Z' });
});
it('preserves real short meeting blocks', () => {
  expect(buildEventInput({ ...task, start_at: '2026-10-01T08:30:00Z' }).start).toEqual({ dateTime: '2026-10-01T08:30:00Z' });
  expect(buildEventInput({ ...task, start_at: '2026-10-01T08:30:00Z' }).end).toEqual({ dateTime: '2026-10-01T09:00:00Z' });
});
it('uses the exclusive next day for a single all-day task', () => {
  const event = buildEventInput({ ...task, is_all_day: true, start_at: '2026-12-31T23:59:59Z', due_at: '2026-12-31T23:59:59Z' });
  expect(event.start).toEqual({ date: '2026-12-31' });
  expect(event.end).toEqual({ date: '2027-01-01' });
});
