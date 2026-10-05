import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { completedTaskOccurrence } from './task-recurrence';
import { projectTaskCalendar } from './task-calendar';

it('preserves legacy rows and queues only new or intentionally changed calendar data', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.tasks(id text primary key, user_id text, project_id text, title text, notes text, priority integer, position integer, start_at timestamptz, due_at timestamptz, is_all_day boolean, rrule text, is_completed boolean default false, completed_at timestamptz, status text, parent_id text, calendar_event_id text, updated_at timestamptz default now());
      insert into tasks(id,title,calendar_event_id,start_at,due_at) values ('legacy','Legacy','linked','2026-10-08 01:00Z','2026-10-10 01:00Z');`);
    // Execute the actual existing status compatibility layer (not unrelated
    // goals/edition schema) before the new migration, matching trigger order.
    const compat = readFileSync('supabase/migrations/0021_api_compat.sql', 'utf8');
    await db.exec(compat.split('-- ===== tasks.status =====')[1].split('-- ===== goals table =====')[0]);
    await db.exec(readFileSync('supabase/migrations/20261005140000_task_time_intent.sql', 'utf8'));
    const row = async (id: string) => (await db.query<Record<string, unknown>>('select * from tasks where id=$1', [id])).rows[0];
    expect(await row('legacy')).toMatchObject({ time_kind: null, calendar_dirty: false, calendar_event_generation: 0, start_at: new Date('2026-10-08T01:00:00Z'), due_at: new Date('2026-10-10T01:00:00Z') });
    await db.exec(`insert into tasks(id,title,time_kind) values ('new','New','deadline')`);
    expect((await row('new')).calendar_dirty).toBe(true);
    await db.exec(`update tasks set title='Changed' where id='legacy'`);
    expect((await row('legacy')).calendar_dirty).toBe(true);
    await db.exec(`update tasks set calendar_dirty=false,calendar_event_id='linked2',calendar_event_generation=1 where id='legacy'`);
    expect((await row('legacy')).calendar_dirty).toBe(false);
    await db.exec(`update tasks set due_at=null,calendar_dirty=false where id='legacy'`);
    expect((await row('legacy')).calendar_dirty).toBe(true);
    await expect(db.exec(`insert into tasks(id,time_kind) values ('bad','invalid')`)).rejects.toThrow();
    await expect(db.exec(`update tasks set calendar_event_generation=-1 where id='legacy'`)).rejects.toThrow();

    // Reproduce why is_completed alone is insufficient under the old INSERT
    // trigger, then insert the shared UI/API completion payload through it.
    await db.exec(`insert into tasks(id,is_completed,completed_at) values ('old-clone',true,now())`);
    expect(await row('old-clone')).toMatchObject({ status: 'open', is_completed: false, completed_at: null });
    const clone = { id: 'clone', ...completedTaskOccurrence({ title: 'Recurring deadline', due_at: '2026-10-08T01:00:00Z', start_at: null, time_kind: 'deadline' }, 'owner', '2026-10-08T01:00:00Z') };
    const entries = Object.entries(clone).filter(([, value]) => value !== undefined);
    await db.query(`insert into tasks (${entries.map(([key]) => key).join(',')}) values (${entries.map((_, i) => `$${i + 1}`).join(',')})`, entries.map(([, value]) => value));
    const history = await row('clone');
    expect(history).toMatchObject({ status: 'done', is_completed: true, rrule: null, calendar_event_id: null });
    expect(projectTaskCalendar(history)).toBeNull();
    const pending = await db.query('select id from tasks where calendar_dirty and calendar_event_id is null and is_completed=false and status not in (\'done\',\'archived\') and (start_at is not null or due_at is not null)');
    expect(pending.rows).not.toContainEqual({ id: 'clone' });
  } finally { await db.close(); }
}, 15000);
