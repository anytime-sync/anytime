import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseQuickInput } from './quick-parse';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T04:00:00Z')); });
afterEach(() => vi.useRealTimers());
it.each(['Submit tomorrow at 9am','Submit 10/8 at 9am','Submit 10/8 document 9am'])('keeps a single time as a deadline: %s', text => {
  const parsed = parseQuickInput(text);
  expect(parsed.start_at).toBeNull(); expect(parsed.due_at).not.toBeNull(); expect(parsed.time_kind).toBe('deadline'); expect(parsed.is_all_day).toBe(false);
});
it('keeps date-only deadlines without a noon default', () => {
  const parsed = parseQuickInput('Submit tomorrow');
  expect(parsed.start_at).toBeNull(); expect(parsed.is_all_day).toBe(true);
  expect(new Date(parsed.due_at!).getHours()).toBe(0);
});
it.each(['Work tomorrow 9am-9:05am','Work tomorrow 9am-5pm','Work 10/8 document 9am-10am'])('keeps deliberate ranges: %s', text => {
  const parsed = parseQuickInput(text);
  expect(parsed.time_kind).toBe('work'); expect(Date.parse(parsed.due_at!)).toBeGreaterThan(Date.parse(parsed.start_at!));
});
it('uses the actual single-time deadline for reminder offsets', () => {
  const parsed = parseQuickInput('Submit tomorrow at 9am remind me 30m before');
  expect(Date.parse(parsed.due_at!) - Date.parse(parsed.reminder_at!)).toBe(1800000);
});
it.each(['Trip 10/8-10/10','Trip 12/30-1/3'])('retains explicit inclusive date spans: %s', text => {
  const parsed = parseQuickInput(text);
  expect(parsed.time_kind).toBe('span'); expect(parsed.is_all_day).toBe(true); expect(parsed.title).toBe('Trip');
  expect(Date.parse(parsed.due_at!)).toBeGreaterThan(Date.parse(parsed.start_at!));
});
it('does not invent endpoints for undated recurring tasks', () => {
  const parsed = parseQuickInput('Write every day');
  expect(parsed.start_at).toBeNull(); expect(parsed.due_at).toBeNull(); expect(parsed.rrule).toBe('FREQ=DAILY');
});
it('anchors server-side Taipei input to the local day near UTC midnight', () => {
  vi.setSystemTime(new Date('2026-10-05T18:00:00Z'));
  expect(parseQuickInput('Submit tomorrow at 9am', { timezoneOffsetMinutes: 480 })).toMatchObject({ start_at: null, due_at: '2026-10-07T01:00:00.000Z' });
  expect(parseQuickInput('Submit tomorrow', { timezoneOffsetMinutes: 480 }).due_at).toBe('2026-10-06T16:00:00.000Z');
});
it('preserves a Taipei date span and separated overnight range on a UTC server', () => {
  expect(parseQuickInput('Trip 10/8-10/10', { timezoneOffsetMinutes: 480 })).toMatchObject({ start_at: '2026-10-07T16:00:00.000Z', due_at: '2026-10-09T16:00:00.000Z', time_kind: 'span' });
  const night = parseQuickInput('10/8 work 11pm-1am', { timezoneOffsetMinutes: 480 });
  expect(Date.parse(night.due_at!) - Date.parse(night.start_at!)).toBe(2 * 3600000);
});
