import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const owner = '00000000-0000-4000-8000-000000000001',
  task = '00000000-0000-4000-8000-000000000002';
it('executes prepared SQL in an ephemeral fixture: atomic history, retry receipt, CAS, ownership and baseline persistence', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${owner}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('fixture.uid',true),'')::uuid $$;
      create function auth.role() returns text language sql as $$ select current_setting('fixture.role',true) $$;
      grant usage on schema auth to authenticated, service_role;
      create table tasks(id uuid primary key default gen_random_uuid(), user_id uuid, project_id uuid, share_group_id uuid, title text, notes text, priority int, position int, start_at timestamptz, due_at timestamptz, is_all_day boolean, rrule text, is_completed boolean default false, completed_at timestamptz, status text, parent_id uuid, calendar_event_id text, reminder_at timestamptz, reminder_sent_at timestamptz, updated_at timestamptz default now());
      create function public.is_project_member(id uuid) returns boolean language sql as $$ select id='00000000-0000-4000-8000-000000000004'::uuid and auth.uid()='00000000-0000-4000-8000-000000000003'::uuid $$;
      create function public.is_share_group_member(id uuid) returns boolean language sql as $$ select false $$;
      create table user_calendar_connections(user_id uuid, provider text, primary_calendar_id text);
      create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
      create trigger tasks_set_updated_at before update on tasks for each row execute function public.set_updated_at();
      alter table tasks enable row level security;
      create policy owner_only on tasks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      grant select,insert,update,delete on tasks to authenticated,service_role;
      grant select on user_calendar_connections to service_role;
      insert into tasks(id,user_id,title,due_at) values('${task}','${owner}','Fixture','2026-03-07T14:00Z');
      insert into user_calendar_connections values('${owner}','google','fixture-calendar');`);
    const compat = readFileSync(
      'supabase/migrations/0021_api_compat.sql',
      'utf8',
    );
    await db.exec(
      compat
        .split('-- ===== tasks.status =====')[1]
        .split('-- ===== goals table =====')[0],
    );
    await db.exec(
      readFileSync(
        'supabase/migrations/20261005140000_task_time_intent.sql',
        'utf8',
      ),
    );
    await db.exec(
      readFileSync(
        'supabase/migrations/20261105080347_worldwide_schedule_sync.sql',
        'utf8',
      ),
    );
    const row = async () =>
      (await db.query<any>('select * from tasks where id=$1', [task])).rows[0];
    expect(await row()).toMatchObject({
      time_kind: null,
      calendar_dirty: false,
      start_date: null,
      due_date: null,
      schedule_timezone: null,
      calendar_baseline: null,
    });
    await db.exec(`set fixture.uid='${owner}'; set fixture.role='authenticated'; set role authenticated;`);
    await expect(db.exec(`update tasks set calendar_etag='forged' where id='${task}'`)).rejects.toThrow('calendar_state_is_server_managed');
    await expect(db.exec(`update tasks set calendar_event_id='forged' where id='${task}'`)).rejects.toThrow('calendar_state_is_server_managed');
    await expect(db.exec(`update tasks set calendar_event_generation=5 where id='${task}'`)).rejects.toThrow('calendar_state_is_server_managed');
    await expect(db.exec(`insert into task_completion_receipts values('${owner}','${task}',now(),'{"forged":true}')`)).rejects.toThrow(/permission denied/);
    await db.exec(`update tasks set title='Native edit still allowed' where id='${task}'`);
    expect((await row()).calendar_dirty).toBe(true);
    await expect(db.exec(`update tasks set calendar_dirty=false where id='${task}'`)).rejects.toThrow('calendar_state_is_server_managed');
    await db.exec(`update tasks set is_all_day=true,time_kind='deadline',due_date='2026-11-05',due_at='2026-11-04T16:00Z',schedule_timezone='Asia/Taipei' where id='${task}'`);
    await expect(db.exec(`update tasks set due_at='2026-11-05T16:00Z' where id='${task}'`)).rejects.toThrow('civil_date_changed_use_current_client');
    expect((await row()).due_date.toISOString().slice(0, 10)).toBe('2026-11-05');
    await db.exec(`update tasks set due_date='2026-11-06',due_at='2026-11-05T16:00Z' where id='${task}'`);
    await db.exec(`update tasks set due_date=null,due_at='2026-03-07T14:00Z',is_all_day=false where id='${task}'; reset role;`);
    await db.exec(`update tasks set time_kind='deadline',schedule_timezone='America/New_York',rrule='FREQ=DAILY;COUNT=2',reminder_offset_min=30 where id='${task}';
      create function reject_fixture_history() returns trigger language plpgsql as $$ begin if new.is_completed then raise exception 'fixture_history_failed'; end if; return new; end $$;
      create trigger zz_fixture_history before insert on tasks for each row execute function reject_fixture_history();
      set fixture.uid='${owner}'; set fixture.role='authenticated'; set role authenticated;`);
    const before = await row();
    const revision = before.updated_at.toISOString();
    const patch = {
      due_at: '2026-03-08T13:00:00Z',
      rrule: 'FREQ=DAILY;COUNT=1',
      reminder_at: '2026-03-08T12:30:00Z',
    };
    const complete = () =>
      db.query<any>(
        'select public.complete_task_occurrence($1,$2,$3,$4) result',
        [owner, task, revision, JSON.stringify(patch)],
      );
    await expect(complete()).rejects.toThrow('fixture_history_failed');
    expect(await row()).toEqual(before);
    await db.exec(
      'reset role; drop trigger zz_fixture_history on tasks; set role authenticated;',
    );
    const result = await complete();
    expect(result.rows[0].result).toMatchObject({
      recurring: true,
      data: { id: task, rrule: 'FREQ=DAILY;COUNT=1' },
    });
    const [retry1, retry2] = await Promise.all([complete(), complete()]);
    expect(retry1.rows).toEqual(result.rows);
    expect(retry2.rows).toEqual(result.rows);
    expect((await db.query('select id from tasks')).rows).toHaveLength(2);
    const history = (
      await db.query<any>('select * from tasks where id<>$1', [task])
    ).rows[0];
    expect(history).toMatchObject({
      is_completed: true,
      status: 'done',
      rrule: null,
      calendar_event_id: null,
      schedule_timezone: 'America/New_York',
    });
    await expect(
      db.query('select public.complete_task_occurrence($1,$2,$3,null)', [
        '00000000-0000-4000-8000-000000000099',
        task,
        revision,
      ]),
    ).rejects.toThrow('task_not_found');
    await expect(
      db.query(
        'select public.reconcile_task_calendar($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          owner,
          task,
          revision,
          'fixture-calendar',
          'event',
          '"v1"',
          '{}',
          '{}',
        ],
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      `reset role; update tasks set calendar_event_id='event',calendar_dirty=true where id='${task}'; set role service_role; set fixture.role='service_role';`,
    );
    const current = await row();
    const reconcile = (rev: string) =>
      db.query<any>(
        'select public.reconcile_task_calendar($1,$2,$3,$4,$5,$6,$7,$8) saved',
        [
          owner,
          task,
          rev,
          'fixture-calendar',
          'event',
          '"v1"',
          JSON.stringify({ summary: 'Remote fixture' }),
          JSON.stringify({ title: 'Remote fixture' }),
        ],
      );
    expect((await reconcile(revision)).rows[0].saved).toBe(false);
    expect(
      (await reconcile(current.updated_at.toISOString())).rows[0].saved,
    ).toBe(true);
    expect(await row()).toMatchObject({
      title: 'Remote fixture',
      calendar_dirty: false,
      calendar_etag: '"v1"',
      calendar_id: 'fixture-calendar',
    });
    await db.exec(`reset role;
      insert into auth.users values('00000000-0000-4000-8000-000000000003');
      create policy shared_fixture_select on tasks for select to authenticated using(project_id='00000000-0000-4000-8000-000000000004');
      create policy shared_fixture_update on tasks for update to authenticated using(project_id='00000000-0000-4000-8000-000000000004') with check(project_id='00000000-0000-4000-8000-000000000004');
      update tasks set project_id='00000000-0000-4000-8000-000000000004' where id='${task}';
      set fixture.uid='00000000-0000-4000-8000-000000000003'; set fixture.role='authenticated'; set role authenticated;`);
    const sharedRevision = (
      await db.query<any>(
        'select updated_at::text revision from tasks where id=$1',
        [task],
      )
    ).rows[0].revision;
    const sharedArgs = [
      owner,
      task,
      sharedRevision,
      JSON.stringify({ ...patch, due_at: '2026-03-09T13:00:00Z' }),
    ];
    await db.query(
      'select public.complete_task_occurrence($1,$2,$3,$4)',
      sharedArgs,
    );
    await db.query(
      'select public.complete_task_occurrence($1,$2,$3,$4)',
      sharedArgs,
    );
    expect(
      (
        await db.query<any>(
          'select count(*)::int n from tasks where user_id=auth.uid() and is_completed',
        )
      ).rows[0].n,
    ).toBe(1);
    await db.exec(
      "reset role; set role service_role; set fixture.role='service_role';",
    );
    await db.query('delete from tasks where id=$1', [task]);
    expect(
      (await db.query('select * from task_completion_receipts')).rows,
    ).toHaveLength(0);
    expect(
      (await db.query<any>('select * from task_calendar_deletion_baselines'))
        .rows[0],
    ).toMatchObject({
      user_id: owner,
      task_id: task,
      event_id: 'event',
      etag: '"v1"',
    });
  } finally {
    await db.close();
  }
}, 20000);

it('account deletion cascades without recreating a provider snapshot for the deleted owner', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create role anon; create role authenticated;
      create table auth.users(id uuid primary key);
      create table tasks(id uuid primary key, user_id uuid references auth.users(id) on delete cascade, calendar_event_id text, calendar_id text, calendar_etag text, calendar_baseline jsonb);
      create table task_calendar_deletion_baselines(user_id uuid references auth.users(id) on delete cascade, event_id text, calendar_id text, task_id uuid, etag text, baseline jsonb, primary key(user_id,event_id));`);
    const sql = readFileSync(
      'supabase/migrations/20261105080347_worldwide_schedule_sync.sql',
      'utf8',
    );
    await db.exec(
      sql.slice(
        sql.indexOf(
          'create function public.save_task_calendar_deletion_baseline()',
        ),
      ),
    );
    await db.query('insert into auth.users values($1)', [owner]);
    await db.query(
      "insert into tasks values($1,$2,'event','primary','etag','{}')",
      [task, owner],
    );
    await db.query('delete from auth.users where id=$1', [owner]);
    expect((await db.query('select * from tasks')).rows).toHaveLength(0);
    expect(
      (await db.query('select * from task_calendar_deletion_baselines')).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 20000);
