'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useUIStore } from '@/store/ui';
import { useLanguage } from '@/lib/use-language';
import type { ActionBrief as Brief, BriefSource } from '@/lib/ai/action-brief';
import { TodayAiBar } from './today-ai-bar';
import { PlanMyDayButton } from './plan-my-day-button';

type Result = Brief & { sources: Omit<BriefSource,'detail'>[]; coverage:string[]; generatedAt:string };
export function ActionBrief() {
  const language = useLanguage();
  const openCapture = useUIStore(s => s.setQuickAddOpen), openTask = useUIStore(s => s.setSelectedTaskId);
  const [result,setResult] = useState<Result|null>(null), [loading,setLoading] = useState(false), [error,setError] = useState('');
  async function brief() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/ai/action-brief',{ method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ tz:Intl.DateTimeFormat().resolvedOptions().timeZone,language }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not prepare brief');
      setResult(data);
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not prepare brief'); }
    finally { setLoading(false); }
  }
  return <section className="rounded-xl border border-border surface p-4 space-y-3" aria-label="Personal assistant">
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-ghost text-sm" onClick={() => openCapture(true)}>Capture</button>
      <button className="btn-primary text-sm" onClick={brief} disabled={loading}>{loading ? 'Preparing brief…' : result ? 'Refresh brief' : 'Brief me'}</button>
      <Link className="btn-ghost text-sm" href="/app/retro">Review with me</Link>
    </div>
    <p className="text-sm text-muted-fg">Capture by typing, voice or image. Brief me surfaces commitments and decisions with their sources.</p>
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
    {result && <div className="space-y-3">
      <p className="text-xs text-muted-fg">Snapshot: {new Date(result.generatedAt).toLocaleString()} · Refresh after changing source records.</p>
      {result.actions.map((action,i) => <article key={i} className="border border-border rounded-lg p-3 space-y-2">
        <h3 className="font-medium">{action.title}</h3><p className="text-sm">{action.why}</p>
        <p className="text-sm"><strong>Suggested next step:</strong> {action.nextAction}</p>
        <div className="flex flex-wrap gap-2">{action.sourceIds.map(id => {
          const source = result.sources.find(s => s.id===id); if (!source) return null;
          return source.kind==='task' ? <button key={id} className="text-xs underline text-accent" onClick={() => openTask(id.slice(5))}>Open: {source.title}</button>
            : <Link key={id} className="text-xs underline text-accent" href="/app/calendar">Calendar: {source.title}{source.date ? ` · ${new Date(source.date).toLocaleString()}` : ''}</Link>;
        })}</div>
      </article>)}
      {!result.actions.length && <p className="text-sm">No supported action was identified from the available records.</p>}
      {result.missingContext.length>0 && <div className="text-sm"><strong>Needs verification</strong><ul className="list-disc pl-5">{result.missingContext.map((m,i)=><li key={i}>{m}</li>)}</ul></div>}
      <details className="text-xs text-muted-fg"><summary className="cursor-pointer">Sources and coverage</summary>{result.coverage.map((c,i)=><p className="mt-2" key={i}>{c}</p>)}<p className="mt-2">{result.sources.length} records considered. Suggestions do not change tasks or send messages.</p></details>
    </div>}
    <details><summary className="cursor-pointer text-sm text-muted-fg">Plan time and priorities</summary><div className="flex flex-wrap gap-2 pt-3"><TodayAiBar/><PlanMyDayButton/><Link className="btn-ghost text-sm" href="/app/next7">Review the week</Link></div></details>
  </section>;
}
