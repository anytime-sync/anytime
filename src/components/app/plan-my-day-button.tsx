'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTasks,useUpdateTask } from '@/hooks/use-tasks';
import { usePlanDay,type PlanWeekSuggestion } from '@/hooks/use-ai';
import { useCanUseFeature } from '@/hooks/use-feature-access';
import { useUIStore } from '@/store/ui';

/** Priority review never assigns arbitrary clock times or clears deadlines. */
export function PlanMyDayButton() {
  const enabled=useCanUseFeature('ai_plan_my_day');
  const {data:tasks=[]}=useTasks({});const update=useUpdateTask(),plan=usePlanDay();
  const openTask=useUIStore(s=>s.setSelectedTaskId);
  const [open,setOpen]=useState(false),[items,setItems]=useState<PlanWeekSuggestion[]>([]),[error,setError]=useState('');
  async function run(){
    const end=new Date();end.setHours(24,0,0,0);
    const candidates=tasks.filter(t=>!t.due_at || Date.parse(t.due_at)<+end).slice(0,40);
    if(!candidates.length){toast.message('No tasks need priority review.');return;}
    setOpen(true);setItems([]);setError('');
    try {const result=await plan.mutateAsync(candidates.map(t=>({id:t.id,title:t.title,due_at:t.due_at,priority:t.priority})));
      if(!result)throw new Error('Priority suggestions are unavailable.');
      setItems(result.suggestions.filter(s=>candidates.some(t=>t.id===s.id)));
    }catch(e){setError(e instanceof Error ? e.message : 'Could not review priorities.');}
  }
  async function apply(item:PlanWeekSuggestion){
    try {await update.mutateAsync({id:item.id,priority:item.suggested_priority});setItems(list=>list.filter(x=>x.id!==item.id));}
    catch {setError('Priority was not saved. Try again.');}
  }
  if(!enabled)return null;
  return <><button className="btn-ghost text-sm" onClick={run} disabled={plan.isPending}>Review priorities</button>
    {open&&<div className="fixed inset-0 z-50 bg-black/40 grid place-items-center" onClick={()=>setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Review priorities" className="card p-5 w-[92vw] max-w-xl max-h-[80vh] overflow-auto space-y-3" onClick={e=>e.stopPropagation()}>
      <div className="flex justify-between"><h2 className="text-xl font-display">Review priorities</h2><button onClick={()=>setOpen(false)}>Close</button></div>
      <p className="text-sm text-muted-fg">Suggestions use task descriptions. Review the reason before accepting. Applying changes priority only; your dates stay intact.</p>
      {error&&<p role="alert" className="text-warning text-sm">{error}</p>}
      {plan.isPending?<p role="status">Reviewing…</p>:items.map(item=><article key={item.id} className="border border-border rounded p-3 space-y-2">
        <button className="font-medium underline text-left" onClick={()=>openTask(item.id)}>{tasks.find(t=>t.id===item.id)?.title}</button>
        <p className="text-sm">{item.reason}</p><p className="text-xs">Proposed priority: {item.suggested_priority}</p>
        <div className="flex gap-3 text-sm"><button className="text-accent" disabled={update.isPending} onClick={()=>void apply(item)}>Use this priority</button><button onClick={()=>setItems(list=>list.filter(x=>x.id!==item.id))}>Keep current</button></div>
      </article>)}
      {!plan.isPending&&!error&&!items.length&&<p className="text-sm">No remaining suggestions.</p>}
    </section></div>}
  </>;
}
