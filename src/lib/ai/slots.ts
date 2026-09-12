import { calendarDate, dayWindow } from '@/lib/day-window';
import type { ScheduleContext } from './schedule-context';
export type Slot = { start_at:string; end_at:string; label:string; fit:'best'|'good'|'backup' };
const minutes = (time:string) => { const [h,m]=time.split(':').map(Number); return h*60+m; };
function wall(date:Date,tz:string) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  return Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
}
/** Deterministic half-open interval search; the model never supplies calendar arithmetic. */
export function findSlots(ctx:ScheduleContext,tz:string,duration:number,now=new Date(),limit=3):Slot[] {
  if (!Number.isInteger(duration) || duration<5 || duration>480) return [];
  const slots:Slot[]=[];
  for (const day of ctx.days) {
    if (day.freeMinutes<duration) continue;
    const {start,nextStart}=dayWindow(day.date,tz);
    for(let ms=+start;ms+duration*60000<=+nextStart;ms+=15*60000) {
      if(ms<+now) continue;
      const s=new Date(ms),e=new Date(ms+duration*60000),sm=wall(s,tz),em=wall(e,tz);
      if(sm%30!==0 || calendarDate(e,tz)!==day.date || sm<minutes(ctx.prefs.workStart) || em>minutes(ctx.prefs.workEnd) || em-sm!==duration) continue;
      if(day.busyBlocks.some(b=>sm<minutes(b.end)&&em>minutes(b.start))) continue;
      slots.push({start_at:s.toISOString(),end_at:e.toISOString(),label:`${duration} min · within recorded availability`,fit:slots.length===0?'best':slots.length===1?'good':'backup'});
      if(slots.length>=limit) return slots;
      ms+=Math.ceil(duration/15)*15*60000-15*60000;
    }
  }
  return slots;
}
export function reserveSlot(ctx:ScheduleContext,tz:string,slot:Slot,title:string) {
  const day=ctx.days.find(d=>d.date===calendarDate(new Date(slot.start_at),tz));if(!day)return;
  const hhmm=(iso:string)=>{const n=wall(new Date(iso),tz);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
  day.busyBlocks.push({start:hhmm(slot.start_at),end:hhmm(slot.end_at),label:title});
  day.freeMinutes=Math.max(0,day.freeMinutes-(Date.parse(slot.end_at)-Date.parse(slot.start_at))/60000);
}
