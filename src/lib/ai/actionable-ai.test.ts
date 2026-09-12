import { expect,it } from 'vitest';
import { findSlots,reserveSlot } from './slots';
import { buildScheduleDays } from './schedule-context';
import { validateBrief,type BriefSource } from './action-brief';
const prefs={workStart:'09:00',workEnd:'18:00',energyPeakStart:'09:00',energyPeakEnd:'12:00',defaultTaskMinutes:30,dailyCapacityMinutes:480};
const now=new Date('2026-09-12T01:00:00Z');
function context(tz='Asia/Taipei') {return {prefs,days:buildScheduleDays(['2026-09-12'],tz,[{start_at:'2026-09-12T01:00:00Z',end_at:'2026-09-12T02:00:00Z'}],[],prefs,now)};}
it('calculates exact local slots after meetings, without inventing UTC offsets',()=>{
  const slots=findSlots(context(),'Asia/Taipei',45,now);
  expect(slots[0].start_at).toBe('2026-09-12T02:00:00.000Z');
  expect(slots[0].end_at).toBe('2026-09-12T02:45:00.000Z');
  expect(slots[1].start_at).toBe('2026-09-12T03:00:00.000Z');
});
it('reserves each bulk suggestion so later tasks cannot overlap it',()=>{
  const ctx=context(),one=findSlots(ctx,'Asia/Taipei',60,now,1)[0];reserveSlot(ctx,'Asia/Taipei',one,'First');
  const two=findSlots(ctx,'Asia/Taipei',60,now,1)[0];expect(Date.parse(two.start_at)).toBeGreaterThanOrEqual(Date.parse(one.end_at));
});
it('rejects invalid duration, exhausted capacity and elapsed slots',()=>{
  expect(findSlots(context(),'Asia/Taipei',0,now)).toEqual([]);
  const ctx=context();ctx.days[0].freeMinutes=20;expect(findSlots(ctx,'Asia/Taipei',30,now)).toEqual([]);
  expect(findSlots(context(),'Asia/Taipei',30,new Date('2026-09-12T10:00:00Z'))).toEqual([]);
});
it('handles fractional-offset timezones',()=>{
  const ctx=context('Asia/Kathmandu');
  expect(findSlots(ctx,'Asia/Kathmandu',30,now,1)[0].start_at).toBe('2026-09-12T03:15:00.000Z');
});
it('handles working hours after a daylight saving transition',()=>{
  const n=new Date('2026-11-01T12:00:00Z');
  const ctx={prefs,days:buildScheduleDays(['2026-11-01'],'America/New_York',[],[],prefs,n)};
  expect(findSlots(ctx,'America/New_York',30,n,1)[0].start_at).toBe('2026-11-01T14:00:00.000Z');
});
const sources:BriefSource[]=[{id:'task:known',kind:'task',title:'Known',detail:'Evidence',date:null}];
it('rejects the whole suggestion when any citation is invented',()=>{
  const result=validateBrief({actions:[{title:'Claim',why:'Reason',nextAction:'Step',sourceIds:['task:known','task:invented']}],missingContext:[]},sources);
  expect(result.actions).toEqual([]);expect(result.missingContext).toHaveLength(1);
});
it('requires a citation and preserves supported actions',()=>{
  const action={title:'Review',why:'A deadline is recorded',nextAction:'Verify outcome',sourceIds:['task:known']};
  expect(validateBrief({actions:[action],missingContext:[]},sources).actions).toEqual([action]);
  expect(()=>validateBrief({actions:[{...action,sourceIds:[]}],missingContext:[]},sources)).toThrow();
});
