import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { safeTimezone } from '@/lib/ai/tz';
import { fetchScheduleContext } from '@/lib/ai/schedule-context';
import { findSlots } from '@/lib/ai/slots';
export const runtime='nodejs';
const Input=z.object({task_id:z.string().uuid(),tz:z.string().optional()});
export async function POST(req:Request) {
  const supabase=createClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:'unauthorized'},{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Invalid task request'},{status:400});
  const {data:task,error}=await supabase.from('tasks').select('id,estimated_minutes').eq('id',parsed.data.task_id).eq('user_id',auth.user.id).eq('is_completed',false).neq('status','archived').maybeSingle();
  if(error)return NextResponse.json({error:'Could not load task'},{status:503});
  if(!task)return NextResponse.json({error:'Task not found'},{status:404});
  try {
    const tz=safeTimezone(parsed.data.tz),ctx=await fetchScheduleContext(supabase,auth.user.id,tz,7);
    const duration=task.estimated_minutes ?? ctx.prefs.defaultTaskMinutes;
    return NextResponse.json({slots:findSlots(ctx,tz,duration),coverage:'Based on synced timed events and tasks, 09:00–18:00. Check all-day events and calendars not connected to First Light before applying.'});
  } catch {return NextResponse.json({error:'Calendar availability could not be verified. Try again.'},{status:503});}
}
