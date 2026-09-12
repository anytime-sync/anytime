'use client';
import { useMemo } from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { useUIStore } from '@/store/ui';

/** Dates flag records for review; they do not establish procrastination or permission to drop work. */
export function ProcrastinationPanel() {
  const { data: tasks = [], isLoading, isError } = useTasks({});
  const openTask = useUIStore(s => s.setSelectedTaskId);
  const candidates = useMemo(() => {
    const now = Date.now();
    return tasks.flatMap(task => {
      const due = task.due_at ? Date.parse(task.due_at) : NaN;
      const updated = Date.parse(task.updated_at);
      const reason = due < now ? 'Deadline passed; verify the outcome or agree a next step.'
        : !task.due_at && updated < now - 14*86400000 ? 'Undated and unchanged for 14 days; confirm whether this is still a commitment.' : null;
      return reason ? [{ task, reason }] : [];
    }).sort((a,b) => (a.task.due_at ?? '9999').localeCompare(b.task.due_at ?? '9999'));
  },[tasks]);
  return <section className="border border-border rounded-lg p-4 surface space-y-3">
    <h3 className="font-display text-xl">Commitments needing review</h3>
    <p className="text-sm text-muted-fg">Check the outcome, owner and next action. Age alone does not explain a blocker.</p>
    {isLoading ? <p role="status">Loading commitments…</p> : isError ? <p role="alert">Could not load commitments. Try again before reviewing.</p> : candidates.length===0 ? <p className="text-sm">No overdue or stale undated commitments found in the loaded records.</p> : <ul className="space-y-2">{candidates.slice(0,8).map(({task,reason}) => <li key={task.id} className="rounded border border-border p-3">
      <div className="flex justify-between gap-3"><strong className="text-sm">{task.title}</strong><button className="text-accent underline text-sm" onClick={() => openTask(task.id)}>Review</button></div>
      <p className="text-sm text-muted-fg mt-1">{reason}</p>
      {task.due_at && <p className="text-xs mt-1">Recorded deadline: {new Date(task.due_at).toLocaleString()}</p>}
    </li>)}</ul>}
    {candidates.length>8 && <p className="text-xs text-muted-fg">Showing 8 of {candidates.length}. Review the remaining commitments in Today.</p>}
  </section>;
}
