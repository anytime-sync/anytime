import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('preserves existing owner/shared access and isolation when adding calendar intent', async () => {
  const db = new PGlite();
  try {
    // Synthetic local RLS model. No production users, credentials, or rows.
    await db.exec(`create role fixture_member nologin;
      create table public.tasks(id text primary key,user_id text,title text,notes text,start_at timestamptz,due_at timestamptz,is_all_day boolean,rrule text,is_completed boolean,status text,parent_id text,calendar_event_id text,updated_at timestamptz default now());
      create table public.fixture_shares(task_id text,member_id text);
      insert into tasks(id,user_id,title,status,is_completed) values ('owned','viewer','Own','open',false),('shared','owner','Shared','open',false),('private','other','Private','open',false);
      insert into fixture_shares values ('shared','viewer');
      alter table public.tasks enable row level security;
      create policy existing_access on public.tasks for all to fixture_member
        using (user_id=current_setting('fixture.user_id') or exists(select 1 from public.fixture_shares s where s.task_id=tasks.id and s.member_id=current_setting('fixture.user_id')))
        with check (user_id=current_setting('fixture.user_id') or exists(select 1 from public.fixture_shares s where s.task_id=tasks.id and s.member_id=current_setting('fixture.user_id')));
      grant usage on schema public to fixture_member;
      grant select,update on public.tasks to fixture_member;
      grant select on public.fixture_shares to fixture_member;`);
    const policySnapshot = () => db.query(`select polname,polroles,polcmd,pg_get_expr(polqual,polrelid) as using_expression,pg_get_expr(polwithcheck,polrelid) as check_expression from pg_policy where polrelid='public.tasks'::regclass order by polname`);
    const before = (await policySnapshot()).rows;
    await db.exec(readFileSync('supabase/migrations/20261005140000_task_time_intent.sql','utf8'));
    expect((await policySnapshot()).rows).toEqual(before);
    expect((await db.query(`select relrowsecurity from pg_class where oid='public.tasks'::regclass`)).rows).toEqual([{ relrowsecurity: true }]);
    expect((await db.query(`select prosecdef from pg_proc where oid='public.mark_task_calendar_dirty()'::regprocedure`)).rows).toEqual([{ prosecdef: false }]);
    await db.exec(`set role fixture_member; set fixture.user_id='viewer';`);
    expect((await db.query('select id from tasks order by id')).rows).toEqual([{ id:'owned' },{ id:'shared' }]);
    expect((await db.query(`update tasks set due_at='2026-11-01T01:00Z',time_kind='deadline' where id='shared' returning id,calendar_dirty`)).rows).toEqual([{ id:'shared', calendar_dirty: true }]);
    expect((await db.query(`update tasks set title='No access' where id='private' returning id`)).rows).toEqual([]);
    await expect(db.exec(`update tasks set user_id='other' where id='owned'`)).rejects.toThrow(/row-level security/i);
    await db.exec('reset role');
    expect((await db.query(`select user_id from tasks where id='owned'`)).rows).toEqual([{ user_id:'viewer' }]);
  } finally { await db.close(); }
}, 15000);
