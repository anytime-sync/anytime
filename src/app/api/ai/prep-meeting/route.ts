import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, MODELS } from '@/lib/anthropic';
import { checkAiBudget, logAiCall } from '@/lib/ai-rate-limit';
import { extractJson } from '@/lib/ai/types';
import { actionBriefPrompt, validateBrief, type BriefSource } from '@/lib/ai/action-brief';
export const runtime='nodejs';
const Input=z.object({task_id:z.string().uuid(),refresh:z.boolean().optional()});
export async function POST(req:Request) {
  const supabase=createClient();const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:'unauthorized'},{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Invalid task request'},{status:400});
  const {data:task,error}=await supabase.from('tasks').select('id,title,notes,project_id,due_at,updated_at').eq('id',parsed.data.task_id).eq('user_id',auth.user.id).neq('status','archived').maybeSingle();
  if(error)return NextResponse.json({error:'Could not read meeting context'},{status:503});
  if(!task)return NextResponse.json({error:'Task not found'},{status:404});
  const [notes,related,prefs]=await Promise.all([
    supabase.from('notes').select('id,title,body,updated_at').eq('user_id',auth.user.id).eq('task_id',task.id).order('updated_at',{ascending:false}).limit(6),
    task.project_id ? supabase.from('tasks').select('id,title,notes,due_at,updated_at').eq('user_id',auth.user.id).eq('project_id',task.project_id).neq('id',task.id).neq('status','archived').eq('is_completed',false).order('due_at',{ascending:true,nullsFirst:false}).limit(13) : Promise.resolve({data:[],error:null}),
    supabase.from('user_preferences').select('language').eq('user_id',auth.user.id).maybeSingle(),
  ]);
  if(notes.error || related.error)return NextResponse.json({error:'Could not verify related meeting records'},{status:503});
  const sources:BriefSource[]=[
    {id:`task:${task.id}`,kind:'task',title:task.title,detail:(task.notes??'').slice(0,16000),date:task.due_at},
    ...(notes.data??[]).slice(0,5).map(n=>({id:`note:${n.id}`,kind:'note' as const,title:n.title,detail:(n.body??'').slice(0,8000),date:n.updated_at})),
    ...(related.data??[]).slice(0,12).map(t=>({id:`task:${t.id}`,kind:'task' as const,title:t.title,detail:(t.notes??'').slice(0,2500),date:t.due_at})),
  ];
  const language=prefs.data?.language??'en';
  const fingerprint='brief-v2:'+createHash('sha256').update(JSON.stringify({sources,language})).digest('hex');
  if(!parsed.data.refresh){
    const {data:cached}=await supabase.from('task_agenda_cache').select('agenda,source_notes').eq('user_id',auth.user.id).eq('task_id',task.id).maybeSingle();
    if(cached?.source_notes===fingerprint)return NextResponse.json({...cached.agenda as object,cached:true});
  }
  const client=getAnthropic();if(!client)return NextResponse.json({error:'Meeting briefing unavailable'},{status:503});
  const budget=await checkAiBudget(auth.user.id,'prep_meeting');if(!budget.ok)return NextResponse.json({error:'Meeting briefing limit reached'},{status:429});
  try {
    const response=await client.messages.create({model:MODELS.fast,max_tokens:1800,system:actionBriefPrompt,
      messages:[{role:'user',content:JSON.stringify({purpose:'Prepare this meeting: '+task.title,language,sources,scope:'Same-project tasks are candidate context, not proof of relevance. No access to Outlook threads or documents unless included in these notes.'})}]});
    const brief=validateBrief(extractJson(response.content.map(c=>c.type==='text'?c.text:'').join('')),sources);
    const out={...brief,agenda:brief.actions.map(a=>a.title),questions:brief.actions.map(a=>a.nextAction),sources:sources.map(({detail,...source})=>source)};
    out.missingContext.push('Based on linked notes and up to 12 open project tasks. Verify relevance; external email and documents were not retrieved.');
    if((notes.data?.length??0)>5 || (related.data?.length??0)>12 || (task.notes?.length??0)>16000)out.missingContext.push('Some context was omitted to keep the brief bounded. Review source records for full detail.');
    await supabase.from('task_agenda_cache').upsert({task_id:task.id,user_id:auth.user.id,agenda:out,source_title:task.title,source_notes:fingerprint,generated_at:new Date().toISOString()},{onConflict:'task_id'});
    await logAiCall(auth.user.id,'prep_meeting',{model:response.model,status:200,inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens});
    return NextResponse.json({...out,cached:false});
  }catch{return NextResponse.json({error:'Could not prepare a supported meeting brief'},{status:502});}
}
