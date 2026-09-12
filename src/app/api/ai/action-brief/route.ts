import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, MODELS } from '@/lib/anthropic';
import { checkAiBudget, logAiCall } from '@/lib/ai-rate-limit';
import { extractJson } from '@/lib/ai/types';
import { safeTimezone } from '@/lib/ai/tz';
import { calendarDate, dayWindow } from '@/lib/day-window';
import { actionBriefPrompt, validateBrief, type BriefSource } from '@/lib/ai/action-brief';

export const runtime = 'nodejs';
const Input = z.object({ tz: z.string().optional(), language: z.string().max(30).optional() });
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const input = Input.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const tz = safeTimezone(input.data.tz), now = new Date();
  const today = calendarDate(now, tz);
  const horizon = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0,10);
  const end = dayWindow(horizon, tz).start.toISOString();
  const [tasks, events] = await Promise.all([
    supabase.from('tasks').select('id,title,notes,due_at,priority,updated_at').eq('user_id',auth.user.id)
      .eq('is_completed',false).neq('status','archived').is('parent_id',null)
      .or(`due_at.lt.${end},due_at.is.null`).order('due_at',{ ascending:true, nullsFirst:false }).limit(41),
    supabase.from('calendar_events').select('id,title,start_at,end_at').eq('user_id',auth.user.id)
      .eq('cancelled',false).gt('end_at',now.toISOString()).lt('start_at',end).order('start_at').limit(21),
  ]);
  if (tasks.error || events.error) return NextResponse.json({ error:'Could not load source records. Try again.' },{ status:503 });
  const sources: BriefSource[] = [
    ...(tasks.data ?? []).slice(0,40).map(t => ({ id:`task:${t.id}`, kind:'task' as const, title:t.title, date:t.due_at,
      detail:`Priority ${t.priority}. Updated ${t.updated_at}. Notes: ${(t.notes ?? '').slice(0,4000)}` })),
    ...(events.data ?? []).slice(0,20).map(e => ({ id:`event:${e.id}`, kind:'event' as const, title:e.title, date:e.start_at, detail:`Ends ${e.end_at}` })),
  ];
  const coverage = ['Based on First Light records only; Outlook/Teams and financial results are not independently verified.',
    ...((events.data?.length ?? 0) === 0 ? ['No upcoming calendar events were found. This does not establish free time.'] : []),
    ...((tasks.data?.length ?? 0)>40 || (events.data?.length ?? 0)>20 ? ['Source list is limited to 40 tasks and 20 events; some records are omitted.'] : [])];
  if (!sources.length) return NextResponse.json({ actions:[], missingContext:['Capture a commitment or link meeting context to prepare a useful brief.'], sources, coverage, generatedAt:now.toISOString() });
  const client = getAnthropic();
  if (!client) return NextResponse.json({ error:'AI briefing is unavailable. Your source tasks remain accessible.' },{ status:503 });
  const budget = await checkAiBudget(auth.user.id,'daily_edition');
  if (!budget.ok) return NextResponse.json({ error:'Briefing limit reached. Review your source tasks or try again later.' },{ status:429 });
  try {
    const response = await client.messages.create({ model:MODELS.fast, max_tokens:1800, system:actionBriefPrompt,
      messages:[{ role:'user', content:JSON.stringify({ now:now.toISOString(), timezone:tz, language:input.data.language ?? 'en', sources }) }] });
    const result = validateBrief(extractJson(response.content.map(c => c.type==='text' ? c.text : '').join('')),sources);
    await logAiCall(auth.user.id,'daily_edition',{ model:response.model,status:200,inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens });
    return NextResponse.json({ ...result, sources:sources.map(({ detail, ...s }) => s), coverage, generatedAt:now.toISOString() });
  } catch {
    return NextResponse.json({ error:'Could not prepare an evidence-based brief. No tasks were changed.' },{ status:502 });
  }
}
