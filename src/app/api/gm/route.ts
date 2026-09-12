import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gmSchema, readGM, writeGM } from '@/lib/gm';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await db.from('tasks').select('id,title,notes,due_at,updated_at,status').eq('user_id', user.id).neq('status', 'archived').order('updated_at', { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: 'Unable to load records' }, { status: 500 });
  return NextResponse.json({ tasks: (data ?? []).map(t => ({ ...t, gm: readGM(t.notes) })), limited: (data?.length ?? 0) >= 1000 });
}
const input = z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(500), updated_at: z.string().optional(), gm: gmSchema });
export async function POST(req: Request) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 });
  const value = parsed.data;
  if (value.id) {
    if (!value.updated_at) return NextResponse.json({ error: 'Reload this record before saving' }, { status: 409 });
    const old = await db.from('tasks').select('notes').eq('user_id', user.id).eq('id', value.id).single();
    if (old.error) return NextResponse.json({ error: 'Record unavailable' }, { status: 404 });
    const result = await db.from('tasks').update({ title: value.title, notes: writeGM(old.data.notes, value.gm), status: value.gm.state === 'Closed' ? 'done' : 'open', is_completed: value.gm.state === 'Closed', completed_at: value.gm.state === 'Closed' ? new Date().toISOString() : null }).eq('user_id', user.id).eq('id', value.id).eq('updated_at', value.updated_at).select('id');
    if (result.error) return NextResponse.json({ error: 'Unable to save' }, { status: 500 });
    if (!result.data?.length) return NextResponse.json({ error: 'Record changed. Reload before saving.' }, { status: 409 });
  } else {
    const result = await db.from('tasks').insert({ user_id: user.id, title: value.title, notes: writeGM('', value.gm), priority: 3, status: value.gm.state === 'Closed' ? 'done' : 'open', is_completed: value.gm.state === 'Closed', completed_at: value.gm.state === 'Closed' ? new Date().toISOString() : null });
    if (result.error) return NextResponse.json({ error: 'Unable to create record' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
