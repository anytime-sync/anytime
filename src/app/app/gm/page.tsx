'use client';
import { useEffect, useState } from 'react';
import { emptyGM, GM, needsAttention } from '@/lib/gm';
import { calendarDate } from '@/lib/day-window';
type RecordRow = { id: string; title: string; notes: string | null; updated_at: string; status: string; gm: GM | null };
export default function GMDesk() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [tab, setTab] = useState('Attention');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [limited, setLimited] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState<GM>(emptyGM);
  const [form, setForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const today = calendarDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  async function reload() {
    setLoading(true);
    try {
      const response = await fetch('/api/gm'); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows(data.tasks); setLimited(data.limited);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  function edit(row: RecordRow | null) {
    setEditing(row); setTitle(row?.title ?? ''); setDraft(row?.gm ?? { ...emptyGM }); setForm(true); setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/gm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing?.id, updated_at: editing?.updated_at, title, gm: draft }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setForm(false); await reload();
    } catch(e) { setError(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setSaving(false); }
  }
  const visible = rows.filter(row => {
    if (!row.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === 'Capture') return !row.gm && row.status === 'open';
    const g = row.gm; if (!g) return false;
    if (tab === 'Closed') return g.state === 'Closed' || row.status === 'done';
    if (g.state === 'Closed' || row.status !== 'open') return false;
    if (tab === 'Attention') return needsAttention(g, today);
    if (tab === 'Waiting') return g.state === 'Waiting';
    return tab === 'All' || g.category === tab;
  }).sort((a,b) => (a.gm?.followUp || '9999').localeCompare(b.gm?.followUp || '9999'));
  const field = (key: keyof GM, value: string) => setDraft(old => ({ ...old, [key]: value }));
  return <main className="mx-auto max-w-5xl p-6 space-y-6">
    <header className="flex justify-between gap-4"><div><p className="text-sm text-muted-foreground">PERSONAL WORKSPACE</p><h1 className="text-3xl font-semibold">GM Desk</h1><p className="text-muted-foreground mt-2">Protect commitments. Make decisions. Follow through.</p></div><button className="rounded-lg bg-primary text-primary-foreground px-4 self-start py-2" onClick={() => edit(null)}>Capture</button></header>
    <p className="text-sm text-muted-foreground">Start with overdue commitments and decisions. Review waiting items weekly; connect P&amp;L exceptions to an owner and a next action. Keep email and meeting source links in the evidence field.</p>
    <nav aria-label="GM views" className="flex flex-wrap gap-2">{['Attention','Waiting','P&L','Strategy','Business review','All','Capture','Closed'].map(label => <button key={label} aria-pressed={tab === label} onClick={() => setTab(label)} className={`rounded-full border px-4 py-2 text-sm ${tab === label ? 'bg-primary text-primary-foreground' : ''}`}>{label}</button>)}</nav>
    <label className="block">Search records<input className="block w-full border rounded p-2 bg-background mt-1" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {error && <p role="alert" className="border border-red-500 rounded p-3">{error}</p>}
    {limited && <p role="alert">Showing the latest 1,000 records. Older items may be missing.</p>}
    {form && <form onSubmit={save} className="border rounded-xl p-5 space-y-4">
      <h2 className="text-xl font-medium">{editing ? 'Review record' : 'Capture a commitment'}</h2>
      <label className="block">Title<input required maxLength={500} className="block w-full border rounded p-2 bg-background" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div className="grid sm:grid-cols-2 gap-4">{(['category','state'] as const).map(key => <label key={key}>{key === 'category' ? 'Workstream' : 'Status'}<select className="block w-full border rounded p-2 bg-background" value={draft[key]} onChange={e => field(key,e.target.value)}>{(key === 'category' ? ['Action','P&L','Strategy','Business review'] : ['Verify','Active','Waiting','Decision','Closed']).map(v => <option key={v}>{v}</option>)}</select></label>)}</div>
      <label className="block">Person to follow up with<input className="block w-full border rounded p-2 bg-background" value={draft.owner} onChange={e => field('owner',e.target.value)} /></label>
      <div className="grid sm:grid-cols-3 gap-4">{(['commitment','followUp','verified'] as const).map(key => <label key={key}>{({ commitment: 'Commitment date', followUp: 'Next follow-up', verified: 'Last verified' })[key]}<input type="date" className="block w-full border rounded p-2 bg-background" value={draft[key]} onChange={e => field(key,e.target.value)} /></label>)}</div>
      <p className="text-sm text-muted-foreground">Moving a follow-up leaves the commitment date unchanged. Existing calendar dates are preserved.</p>
      {(['outcome','nextAction','evidence'] as const).map(key => <label className="block" key={key}>{({ outcome: 'Intended outcome / P&L impact (include period, unit and comparator)', nextAction: 'Next action / decision required', evidence: 'Source links, verification and closure evidence' })[key]}<textarea maxLength={2000} className="block w-full border rounded p-2 bg-background" value={draft[key]} onChange={e => field(key,e.target.value)} /></label>)}
      <div className="flex gap-3"><button disabled={saving} className="rounded bg-primary text-primary-foreground px-4 py-2">{saving ? 'Saving…' : 'Save'}</button><button type="button" disabled={saving} onClick={() => setForm(false)}>Cancel</button></div>
    </form>}
    {loading ? <p role="status">Loading records…</p> : !visible.length ? <p className="p-8 border rounded-xl">No records in this view. Use Capture to add a record or bring an existing task into GM Desk.</p> : <div className="space-y-3">{visible.map(row => <article key={row.id} className="border rounded-xl p-5 space-y-2"><div className="flex justify-between gap-4"><h2 className="font-semibold">{row.title}</h2><button className="underline shrink-0" onClick={() => edit(row)}>{row.gm ? 'Review' : 'Add to GM Desk'}</button></div>{row.gm && <><p className="text-sm">{row.gm.category} · {row.gm.state} · {row.gm.owner || 'Owner unconfirmed'}</p><p>{row.gm.nextAction || 'Next action needs clarification'}</p><p className="text-sm">Commitment: {row.gm.commitment || 'Unconfirmed'} · Follow-up: {row.gm.followUp || 'Not scheduled'}</p>{row.gm.commitment && row.gm.commitment < today && row.gm.state !== 'Closed' && row.status === 'open' && <p className="text-amber-600">Commitment overdue — verify the outcome</p>}<p className="text-sm text-muted-foreground">Last verified: {row.gm.verified || 'Not yet verified'}</p>{row.gm.outcome && <p>{row.gm.outcome}</p>}{row.gm.evidence && <p className="whitespace-pre-wrap text-sm">{row.gm.evidence}</p>}</>}<details><summary className="text-sm cursor-pointer">Source notes and history</summary><pre className="whitespace-pre-wrap text-sm mt-2">{(row.notes ?? '').replace(/^<!-- firstlight-gm:v1\n[\s\S]*?\n-->\n?/, '') || 'No source notes'}</pre></details></article>)}</div>}
  </main>;
}
