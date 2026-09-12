import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { safeTimezone } from '@/lib/ai/tz';
import { fetchScheduleContext } from '@/lib/ai/schedule-context';
import { findSlots,reserveSlot } from '@/lib/ai/slots';
export const runtime='nodejs';
const Input=z.object({tz:z.string().optional(),tasks:z.array(z.object({id:z.string().uuid()})).min(1).max(40)});
export async function POST(req:Request) {
  const supabase=createClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:'unauthorized'},{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Invalid task request'},{status:400});
  const now=new Date();
  const {data:tasks,error}=await supabase.from('tasks').select('id,title,estimated_minutes,due_at,priority').eq('user_id',auth.user.id)
    .in('id',Array.from(new Set(parsed.data.tasks.map(t=>t.id)))).eq('is_completed',false).neq('status','archived').lt('due_at',now.toISOString())
    .order('priority',{ascending:false}).order('due_at');
  if(error)return NextResponse.json({error:'Could not load overdue tasks'},{status:503});
  try {
    const tz=safeTimezone(parsed.data.tz),ctx=await fetchScheduleContext(supabase,auth.user.id,tz,14);
    const suggestions=[];let unplaced=0;
    for(const task of tasks ?? []) {
      const slot=findSlots(ctx,tz,task.estimated_minutes ?? ctx.prefs.defaultTaskMinutes,now,1)[0];
      if(!slot){unplaced++;continue;}
      reserveSlot(ctx,tz,slot,task.title);
      suggestions.push({id:task.id,start_at:slot.start_at,due_at:slot.end_at,verdict:'reschedule',reason:'Calculated from recorded availability. Applying changes this task’s dates; verify the commitment before accepting.'});
    }
    return NextResponse.json({suggestions,unplaced,coverage:'Based on synced timed events and tasks, 09:00–18:00. Check all-day events and other calendars. Unplaced tasks keep their dates.'});
  } catch {return NextResponse.json({error:'Calendar availability could not be verified. No dates were changed.'},{status:503});}
}
