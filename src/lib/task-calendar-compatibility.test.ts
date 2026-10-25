import { describe, expect, it } from 'vitest';
import { buildIcs, type IcsTaskRow } from './ical-feed';
import { buildIcs as oldIcs } from './__fixtures__/calendar-main-eae82d4/ical-feed';
import { calendarTask as oldCalendarTask } from './__fixtures__/calendar-main-eae82d4/task-schedule';
import { validCalendarBlock as oldGoogleEligibility } from './__fixtures__/calendar-main-eae82d4/google-eligibility';
import { buildEventInput } from './calendar-write';
import { calendarTask, createTaskDates, resolveTaskDates, taskTimeKind, type TaskDates } from './task-schedule';
import { nextTaskRecurrence } from './task-recurrence';
import { taskCalendarWindowFilter } from './task-calendar';

const base: IcsTaskRow = { id:'synthetic',title:'Synthetic task',notes:null,start_at:'2026-10-23T01:00:00Z',due_at:'2026-10-23T02:00:00Z',is_all_day:false,is_completed:false,status:'open',rrule:null,created_at:'2026-09-01T00:00:00Z',updated_at:'2026-10-03T00:00:00Z',estimated_minutes:null };
const now = new Date('2026-10-25T12:00:00Z');
const cases: Array<Partial<IcsTaskRow>> = [
  {}, { due_at:'2026-10-24T01:00:00Z' }, { due_at:'2026-11-02T01:00:00Z' },
  { is_all_day:true,due_at:'2026-11-02T01:00:00Z' },
  { start_at:null,is_all_day:true }, { start_at:null,is_all_day:false },
  { due_at:null,is_all_day:true }, { due_at:base.start_at },
  { due_at:'2026-10-22T01:00:00Z' }, { start_at:null,estimated_minutes:10000 },
  { start_at:'2026-10-23',due_at:'2026-10-25',is_all_day:true },
  { rrule:'FREQ=WEEKLY;COUNT=3' },
  { is_all_day:true,rrule:'FREQ=DAILY;UNTIL=20261101T030000Z;BYHOUR=9' },
  { notes:'  ' }, { is_completed:true,status:'done' },
];

describe('unknown historical intent compatibility', () => {
  it('restricts the new enclosing-window selection to classified ranges', () => {
    const min='2025-10-25T00:00:00Z',max='2027-10-25T00:00:00Z';
    const filter=taskCalendarWindowFilter(min,max);
    expect(filter).toContain(`and(time_kind.not.is.null,start_at.lt.${min},due_at.gt.${max})`);
    expect(filter).not.toContain(`and(start_at.lt.${min},due_at.gt.${max})`);
    expect(filter).toContain(`and(start_at.gte.${min},start_at.lte.${max})`);
    expect(filter).toContain(`and(due_at.gte.${min},due_at.lte.${max})`);
  });
  it.each(['Asia/Taipei','America/New_York'])('matches actual old-main ICS and UI output in %s', zone => {
    for (const dates of cases) for (const time_kind of [undefined,null]) {
      const task = { ...base,...dates,time_kind };
      const before = structuredClone(task);
      expect(taskTimeKind(task)).toBeNull();
      expect(buildIcs([task],zone,now)).toBe(oldIcs([task],zone,now));
      expect(calendarTask(task)).toEqual(oldCalendarTask(task));
      expect(task).toEqual(before);
    }
  });
  it('keeps old Google eligibility and payload without changing recurrence/date mode', () => {
    for (const dates of cases) {
      const task = { ...base,...dates,user_id:'owner',calendar_event_id:null };
      const event = buildEventInput(task,'Asia/Taipei');
      const eligible = !task.is_completed && oldGoogleEligibility(task as any);
      expect(!!event).toBe(eligible);
      if (event) {
        expect(event.start).toEqual({ dateTime:task.start_at });
        expect(event.end).toEqual({ dateTime:task.due_at });
        expect(event).not.toHaveProperty('recurrence');
        expect(event).not.toHaveProperty('transparency');
      }
      expect(task.time_kind).toBeUndefined();
    }
  });
  it('keeps a legacy UTC recurrence unchanged in a mixed feed with explicit local work', () => {
    const legacy = { ...base,rrule:'FREQ=WEEKLY;COUNT=3' };
    const explicit = { ...legacy,id:'explicit',time_kind:'work' as const };
    const event = (ics:string,id:string) => ics.split('BEGIN:VEVENT\r\n').find(part => part.startsWith(`UID:${id}@`))!.split('END:VEVENT')[0];
    const mixed = buildIcs([legacy,explicit],'America/New_York',now);
    expect(event(mixed,legacy.id)).toBe(event(oldIcs([legacy],'America/New_York',now),legacy.id));
    expect(event(mixed,'explicit')).toContain('DTSTART;TZID=America/New_York');
  });
  it('does not infer intent or rewrite availability during automatic recurring completion', () => {
    for (const dates of [{}, { due_at:'2026-11-02T01:00:00Z' }, { is_all_day:true,due_at:'2026-11-02T01:00:00Z' }]) {
      const task = { ...base,...dates,time_kind:null,rrule:'FREQ=WEEKLY;COUNT=3' };
      const next = nextTaskRecurrence(task,'America/New_York')!;
      expect(next.patch.time_kind).toBeNull();
      expect(next.patch.rrule).toBe('FREQ=WEEKLY;COUNT=2');
      if (dates.due_at) expect(next.patch).not.toHaveProperty('start_at');
      const result = { ...task,...next.patch };
      expect(buildIcs([result],'America/New_York',now)).toBe(oldIcs([result],'America/New_York',now));
    }
  });
});

describe('explicit/newly edited task semantics', () => {
  it.each(['work','span'] as const)('retains an explicit long %s while the same unknown interval stays collapsed', kind => {
    const task = { ...base,is_all_day:kind==='span',due_at:'2026-11-02T01:00:00Z' };
    expect(buildIcs([task],'Asia/Taipei',now)).toBe(oldIcs([task],'Asia/Taipei',now));
    const explicit = { ...task,time_kind:kind };
    const ics = buildIcs([explicit],'Asia/Taipei',now);
    expect(ics).toContain(kind==='work' ? 'DTSTART:20261023T010000Z\r\nDTEND:20261102T010000Z' : 'DTSTART;VALUE=DATE:20261023\r\nDTEND;VALUE=DATE:20261103');
    const input = buildEventInput({ ...explicit,user_id:'owner',calendar_event_id:null },'Asia/Taipei')!;
    expect(input.end).toMatchObject(kind==='work' ? { dateTime:'2026-11-02T01:00:00.000Z' } : { date:'2026-11-03' });
  });
  it('creates date-only deadlines with no invented endpoint or timed block', () => {
    const dates = createTaskDates({ due_at:'2026-10-25',is_all_day:true });
    expect(dates).toMatchObject({ time_kind:'deadline' });
    expect(dates).not.toHaveProperty('start_at');
    const task = { ...base,start_at:null,...dates };
    expect(buildIcs([task],'America/New_York',now)).toContain('DTSTART;VALUE=DATE:20261025\r\nDTEND;VALUE=DATE:20261026');
    expect(buildEventInput({ ...task,user_id:'owner',calendar_event_id:null },'America/New_York')?.start).toMatchObject({ date:'2026-10-25' });
  });
  it('records deadline intent for a due edit without carrying an unknown historical duration', () => {
    const current = { ...base,due_at:'2026-11-02T01:00:00Z' };
    const patch = resolveTaskDates(current,{ due_at:'2026-11-09T01:00:00Z' });
    expect(patch).toEqual({ due_at:'2026-11-09T01:00:00Z',time_kind:'deadline' });
    expect(current.start_at).toBe(base.start_at);
    expect(buildIcs([{ ...current,...patch }],'Asia/Taipei',now)).toContain('DTSTART;VALUE=DATE:20261109\r\nDTEND;VALUE=DATE:20261110');
  });
  it('requires deliberate new paired input or explicit choice to enable a work/span range', () => {
    const current = { ...base,due_at:'2026-11-02T01:00:00Z' };
    // Detail editor sends the other, unchanged endpoint too: this is not a new range.
    expect(resolveTaskDates(current,{ start_at:current.start_at,due_at:'2026-11-09T01:00:00Z' }).time_kind).toBe('deadline');
    const start_at='2026-11-10T01:00:00Z',due_at='2026-11-13T01:00:00Z';
    expect(resolveTaskDates(current,{ start_at,due_at }).time_kind).toBe('work');
    expect(resolveTaskDates(current,{ start_at,due_at,is_all_day:true }).time_kind).toBe('span');
    expect(createTaskDates({ start_at,due_at }).time_kind).toBe('work');
    expect(resolveTaskDates(current,{ time_kind:'work' }).time_kind).toBe('work');
    expect(resolveTaskDates(current,{ time_kind:null }).time_kind).toBeNull();
    expect(resolveTaskDates(current,{ title:'Metadata only' } as TaskDates & { title:string })).not.toHaveProperty('time_kind');
  });
});
