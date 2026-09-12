import { getUserPlan } from '@/lib/billing';
import { canUseFeature } from '@/lib/feature-flags';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiAuth,jsonError,jsonOk } from '../../_lib/auth';
import { safeTimezone } from '@/lib/ai/tz';
import { fetchScheduleContext } from '@/lib/ai/schedule-context';
import { findSlots,reserveSlot } from '@/lib/ai/slots';
export const runtime='nodejs';
export async function POST(req:NextRequest) {
  const ctx=await requireApiAuth(req,'write');if(!ctx.ok)return ctx.response;
  if(!(await canUseFeature(await getUserPlan(ctx.userId),'ai_reschedule_task')))return jsonError(403,'feature_unavailable','This planning feature is unavailable for this account.');
  const text=await req.text();let body:unknown={};
  try {body=text?JSON.parse(text):{};}catch{return jsonError(400,'bad_request','Invalid JSON.');}
  const input=z.object({tz:z.string().optional()}).safeParse(body);
  if(!input.success)return jsonError(400,'bad_request','Expected an object.');
  const now=new Date();
  const {data:tasks,error}=await ctx.supabase.from('tasks').select('id,title,estimated_minutes,due_at,priority').eq('user_id',ctx.userId)
    .eq('is_completed',false).neq('status','archived').lt('due_at',now.toISOString()).order('priority',{ascending:false}).order('due_at').limit(20);
  if(error)return jsonError(503,'tasks_unavailable','Could not read overdue tasks.');
  if(!tasks?.length)return jsonOk({items:[],unplaced:0});
  try {
    const tz=safeTimezone(input.data.tz),schedule=await fetchScheduleContext(ctx.supabase,ctx.userId,tz,14);const items=[];let unplaced=0;
    for(const task of tasks){
      const slot=findSlots(schedule,tz,task.estimated_minutes??schedule.prefs.defaultTaskMinutes,now,1)[0];
      if(!slot){unplaced++;continue;}reserveSlot(schedule,tz,slot,task.title);
      items.push({id:task.id,start_at:slot.start_at,due_at:slot.end_at,new_due_at:slot.end_at,reason:'Calculated slot from recorded availability. Review before changing the commitment.'});
    }
    return jsonOk({items,unplaced,coverage:'Synced timed events and tasks only, 09:00–18:00; check other calendars and all-day events. Up to 20 overdue tasks considered.'});
  }catch{return jsonError(503,'availability_unavailable','Calendar availability could not be verified.');}
}
