import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiAuth,jsonError,jsonOk } from '../../_lib/auth';
import { safeTimezone } from '@/lib/ai/tz';
import { fetchScheduleContext } from '@/lib/ai/schedule-context';
import { findSlots } from '@/lib/ai/slots';
export const runtime='nodejs';
const Input=z.object({task_id:z.string().uuid(),tz:z.string().optional()});
export async function POST(req:NextRequest) {
  const ctx=await requireApiAuth(req,'write');if(!ctx.ok)return ctx.response;
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return jsonError(400,'bad_request','Provide a valid task_id.');
  const {data:task,error}=await ctx.supabase.from('tasks').select('id,estimated_minutes').eq('id',parsed.data.task_id).eq('user_id',ctx.userId).eq('is_completed',false).neq('status','archived').maybeSingle();
  if(error)return jsonError(503,'tasks_unavailable','Could not read task.');
  if(!task)return jsonError(404,'not_found','Task not found.');
  try {
    const tz=safeTimezone(parsed.data.tz),schedule=await fetchScheduleContext(ctx.supabase,ctx.userId,tz,7);
    return jsonOk({slots:findSlots(schedule,tz,task.estimated_minutes??schedule.prefs.defaultTaskMinutes),coverage:'Synced timed events and tasks only, 09:00–18:00; check other calendars and all-day events.'});
  }catch{return jsonError(503,'availability_unavailable','Calendar availability could not be verified.');}
}
