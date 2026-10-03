"use client";
import { useEffect, useRef, useState } from 'react';
import { useCreateTask } from '@/hooks/use-tasks';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { todayIntent, TUTORIAL_TITLES } from '@/lib/activation';
import { track } from '@/lib/track';
import { useUIStore } from '@/store/ui';
import { UsageConsent } from '@/components/usage-consent';
import { useLanguage } from '@/lib/use-language';

export function OnboardingModal() {
  const lang = useLanguage();
  const zh = lang === 'zh-TW' || lang === 'zh-CN';
  const create = useCreateTask();
  const openTask = useUIStore(s => s.setSelectedTaskId);
  const [owner, setOwner] = useState('');
  const { data: eligible } = useQuery({
    queryKey: ['activation-eligibility', owner], enabled: Boolean(owner),
    queryFn: async () => {
      const tutorialTitles = `(${Array.from(TUTORIAL_TITLES).map(title => JSON.stringify(title)).join(',')})`;
      const { data, error } = await createClient().from('tasks').select('id')
        .eq('user_id', owner).is('parent_id', null).neq('status', 'archived')
        .not('title', 'in', tutorialTitles).limit(1).maybeSingle();
      if (error) throw error;
      return !data;
    },
  });
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(['','','']);
  const [saved, setSaved] = useState<{id:string;title:string}[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus();
  }, [open]);
  const seenKey = `fl.activation.v1.${owner}`;
  useEffect(() => { let alive = true; void createClient().auth.getUser().then(({data}) => { if(alive && data.user) setOwner(data.user.id); }); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (!owner || eligible !== true) return;
    try { if (localStorage.getItem(seenKey)) return; } catch { return; }
    setOpen(true); track('activation.opened');
  }, [owner, eligible, seenKey]);
  function close(skipped = false) {
    if (saving.current) return;
    try { localStorage.setItem(seenKey,'1'); } catch {}
    if (skipped) track('activation.skipped');
    setOpen(false);
  }
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    const created = [...saved];
    try {
      for (let i = 0; i < values.length; i++) {
        const title = values[i].trim(); if (!title) continue;
        const task = await create.mutateAsync({title,...todayIntent(),priority:created.length === 0 ? 5 : 3});
        created.push({id:task.id,title});
        // Clear each persisted input so a retry cannot create it twice.
        setValues(v => v.map((text,index) => index === i ? '' : text));
      }
      setSaved(created);
      track('activation.saved',{count:created.length});
      try { localStorage.setItem(seenKey,'1'); } catch {}
    } catch { setSaved(created); setError(zh ? '部分任務尚未儲存，請重試。已儲存的任務不會重複新增。' : 'Some tasks were not saved. Retry to save the rest.'); }
    finally { saving.current = false; setBusy(false); }
  }
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"><section ref={panel} role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="activation-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(!saved.length); }
    if (event.key !== 'Tab') return;
    const elements = panel.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled),a[href]');
    if (!elements?.length) { event.preventDefault(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }} className="surface border border-border rounded-xl max-w-lg w-full p-7 space-y-4">
    <h2 id="activation-title" className="font-display text-3xl">{zh ? '今天，先完成一件重要的事。' : 'Make room for one important thing.'}</h2>
    {saved.length > 0 && !error ? <>
      <p className="text-muted-fg">{zh ? '先從這件事開始：' : 'Start here:'}</p><p className="text-lg font-medium">{saved[0].title}</p>
      <p className="text-sm text-muted-fg">{zh ? '其他任務已放入今天的清單。準備好後，再按「Brief me」查看任務與行事曆重點。' : 'Your other tasks are in Today. When ready, use Brief me to review your tasks and calendar.'}</p>
      <button className="btn-primary px-4 h-10" onClick={() => {track('activation.started'); close(); openTask(saved[0].id);}}>{zh ? '開始第一件事' : 'Start my first task'}</button>
    </> : <>
      <p className="text-sm text-muted-fg">{zh ? '輸入最多三件今天想完成的事，最重要的放第一個。不需要先設定行事曆。' : 'Add up to three things you want to move today. Put the most important first. No calendar setup needed.'}</p>
      {values.map((value,i) => <label className="block text-sm space-y-1" key={i}><span>{i === 0 ? (zh ? '最重要的一件事' : 'My most important task') : (zh ? `其他任務 ${i+1}（選填）` : `Another task ${i+1} (optional)`)}</span><input autoFocus={i===0} className="input w-full" maxLength={140} value={value} disabled={busy} onChange={e => setValues(v => v.map((x,n)=>n===i?e.target.value:x))}/></label>)}
      {error && <p role="alert" className="text-warning text-sm">{error}</p>}
      <UsageConsent />
      <button className="btn-primary px-4 h-10" disabled={busy || values.every(v=>!v.trim())} onClick={save}>{busy ? (zh ? '儲存中…' : 'Saving…') : (zh ? '建立今天的清單' : 'Set up my Today')}</button>
    </>}
    <button className="btn-ghost px-3 h-10" disabled={busy} onClick={()=>close(!saved.length)}>{zh ? '稍後再做' : 'Later'}</button>
  </section></div>;
}
