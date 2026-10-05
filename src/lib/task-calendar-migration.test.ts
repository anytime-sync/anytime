import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('preserves legacy rows and queues only new or intentionally changed calendar data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.tasks(id text primary key, user_id text, title text, notes text, start_at timestamptz, due_at timestamptz, is_all_day boolean, rrule text, is_completed boolean, status text, parent_id text, calendar_event_id text, updated_at timestamptz default now());
      insert into tasks(id,title,calendar_event_id,start_at,due_at) values ('legacy','Legacy','linked','2026-10-08 01:00Z','2026-10-10 01:00Z');`);
    await db.exec(readFileSync('supabase/migrations/20261005140000_task_time_intent.sql', 'utf8'));
    const row = async (id: string) => (await db.query<Record<string, unknown>>('select * from tasks where id=$1', [id])).rows[0];
    expect(await row('legacy')).toMatchObject({ time_kind: null, calendar_dirty: false, start_at: new Date('2026-10-08T01:00:00Z'), due_at: new Date('2026-10-10T01:00:00Z') });
    await db.exec(`insert into tasks(id,title,time_kind) values ('new','New','deadline')`);
    expect((await row('new')).calendar_dirty).toBe(true);
    await db.exec(`update tasks set title='Changed' where id='legacy'`);
    expect((await row('legacy')).calendar_dirty).toBe(true);
    await db.exec(`update tasks set calendar_dirty=false,calendar_event_id='linked2' where id='legacy'`);
    expect((await row('legacy')).calendar_dirty).toBe(false);
    await db.exec(`update tasks set due_at=null,calendar_dirty=false where id='legacy'`);
    expect((await row('legacy')).calendar_dirty).toBe(true);
    await expect(db.exec(`insert into tasks(id,time_kind) values ('bad','invalid')`)).rejects.toThrow();
  } finally { await db.close(); }
}, 15000);
